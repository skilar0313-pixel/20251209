const TOTAL_FRAMES = 35;
let frames = [];
let currentFrame = 0;
const FRAME_INTERVAL = 100; // ms per frame
let lastFrameTime = 0;
let displayW = 200;
let displayH = 200;
let y848sound = null;
let soundPlaying = false;
// Player / physics
let playerX = 0;
let playerY = 0;
let vy = 0;
let gravity = 0.8;
let jumpForce = -15;
let moveSpeed = 6;
let onGround = false;
let groundY = 0;
// Micky sprite
let mickyFrames = [];
const MICKY_TOTAL = 16;
let mickyFrame = 0;
let mickyLastFrameTime = 0;
const MICKY_INTERVAL = 120; // ms per frame
// Right-side character (角色3)
let rightFrames = [];
const RIGHT_TOTAL = 5;
let rightFrame = 0;
let rightLastFrameTime = 0;
const RIGHT_INTERVAL = 160;
// Left-far character (角色4)
let leftFarFrames = [];
const LEFTFAR_TOTAL = 20;
let leftFarFrame = 0;
let leftFarLastFrameTime = 0;
const LEFTFAR_INTERVAL = 140;
// Micky physics (independent from main player)
let mickyX = 0;
let mickyY = 0;
let mVy = 0;
let mGravity = 0.8;
let mJumpForce = -12;
let mSpeed = 4;
let mOnGround = false;
// Dialog / input state
let inputActive = false;       // whether the middle player's input box is open
let inputText = '';
let inputSubmitted = false;    // whether player has submitted input
let mickyDialogText = '';      // text shown above micky
// question bank loaded from CSV
let questionsCSV = null; // raw lines loaded by loadStrings
let questions = [];
let currentQuestionIndex = -1;
// particle/ticket effect
let tickets = [];
const TICKET_GRAVITY = 0.3;
let mDisplayWCurrent = undefined;
let mDisplayHCurrent = undefined;
// right character display sizes and dialog
let rDisplayWCurrent = undefined;
let rDisplayHCurrent = undefined;
let rightDialogText = '';
let rightX = 0;
let rightY = 0;
// left-far character display sizes and dialog
let lfDisplayWCurrent = undefined;
let lfDisplayHCurrent = undefined;
let leftFarDialogText = '';
let leftFarX = 0;
let leftFarY = 0;
// question type tracking
let currentQuestionType = 'math'; // 'math' or 'english'
let mathCompleted = false; // whether math round is completed
let englishCompleted = false; // whether english round is completed
let showingCompletionMessage = false; // show "press enter for next" message after correct
let nextQuestionTimer = 0; // millis timestamp when to auto-advance

function preload() {
  // Load individual frame files all0001.png ... all0035.png
  for (let i = 1; i <= TOTAL_FRAMES; i++) {
    const idx = String(i).padStart(4, '0');
    frames.push(loadImage(`1/all${idx}.png`));
  }
  // Load micky frames 0.png .. 15.png from `micky/`
  for (let i = 0; i < MICKY_TOTAL; i++) {
    mickyFrames.push(loadImage(`micky/${i}.png`));
  }
  // Load right-side character frames ALL001..ALL005 from `3/` folder
  for (let i = 1; i <= RIGHT_TOTAL; i++) {
    const idx = String(i).padStart(4, '0');
    // filenames expected: ALL0001.png .. ALL0005.png
    rightFrames.push(loadImage(`3/ALL${idx}.png`));
  }
  // Load left-far character frames all0001..all0020 from `4/` folder (lowercase)
  for (let i = 1; i <= LEFTFAR_TOTAL; i++) {
    const idx = String(i).padStart(4, '0');
    // filenames expected: all0001.png .. all0020.png
    leftFarFrames.push(loadImage(`4/all${idx}.png`));
  }
  // Load sound file y848 (ensure path matches project)
  y848sound = loadSound('y848.wav');
  // Load question bank CSV (placed in same folder as index.html)
  // Expected header columns: 題目, 答案, 答對回饋, 提示, 題型
  // File name: `questions.csv` (create this in the project root or alongside index.html)
  // Use loadStrings to avoid p5.loadTable streaming issue in some servers
  try {
    questionsCSV = loadStrings('questions.csv',
      () => { console.log('questions.csv 載入完成'); },
      (err) => { console.warn('載入 questions.csv 失敗，請檢查檔案路徑與伺服器', err); }
    );
  } catch (e) {
    console.warn('載入 questions.csv 時發生例外', e);
  }
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  imageMode(CENTER);
  noSmooth();
  if (frames.length > 0) {
    // assume all frames same size
    displayW = frames[0].width * 4;
    displayH = frames[0].height * 4;
  }
  // initialize player position on the ground
  playerX = width / 2;
  groundY = height - displayH / 2 - 20;
  playerY = groundY;
  // initialize micky position to the left of the main player
  mickyX = playerX - displayW - 40;
  mickyY = groundY;

  // initialize right character position to the right of the main player
  rightX = playerX + displayW + 40;
  rightY = groundY;

  // initialize left-far character position to the far left of micky
  leftFarX = mickyX - displayW * 0.8 - 60;
  leftFarY = groundY;

  // parse loaded questions table (if available)
  if (questionsCSV && Array.isArray(questionsCSV) && questionsCSV.length > 0) {
    try {
      // remove empty lines
      const lines = questionsCSV.map(s => s.trim()).filter(s => s.length > 0);
      if (lines.length < 2) {
        console.warn('questions.csv 欄位不足或沒有資料（至少要有表頭與一列）');
      } else {
        // parse header (handle BOM)
        const rawHeader = lines[0].replace(/\uFEFF/, '');
        const headers = rawHeader.split(',').map(h => h.trim());
        const idxMap = {};
        headers.forEach((h, i) => { idxMap[h] = i; });
        // expected headers: 題目, 答案, 答對回饋, 提示, 題型（題型可選）
        for (let i = 1; i < lines.length; i++) {
          const row = lines[i].split(',').map(c => c.trim());
          const q = row[idxMap['題目']] || '';
          const a = row[idxMap['答案']] || '';
          const fb = row[idxMap['答對回饋']] || '';
          const hint = row[idxMap['提示']] || '';
          const type = row[idxMap['題型']] || 'math'; // 'math' or 'english', default to 'math'
          questions.push({題目: q, 答案: a, 答對回饋: fb, 提示: hint, 題型: type});
        }
        if (questions.length > 0) console.log('已載入題庫數量:', questions.length);
      }
    } catch (e) {
      console.warn('解析 questions.csv 時發生問題，請檢查 CSV 格式（逗號分隔，首行為表頭）', e);
    }
  } else {
    console.log('未找到 questions.csv，將使用預設文字作為 fallback。');
  }
}

function draw() {
  background('#ffcad4');
  if (frames.length === 0) {
    fill(0);
    textAlign(CENTER, CENTER);
    textSize(18);
    text('找不到動畫幀：請確認 `1/` 資料夾內有 all0001..all0035.png', width / 2, height / 2);
    return;
  }

  if (millis() - lastFrameTime > FRAME_INTERVAL) {
    currentFrame = (currentFrame + 1) % TOTAL_FRAMES;
    lastFrameTime = millis();
  }

  const img = frames[currentFrame];
  // Micky controls: A/D for left/right movement (hold), W to jump (press)
  if (keyIsDown(65)) { // 'A'
    mickyX -= mSpeed;
  }
  if (keyIsDown(68)) { // 'D'
    mickyX += mSpeed;
  }

  // Apply gravity to micky
  mVy += mGravity;
  mickyY += mVy;

  // Ground collision for micky
  if (mickyY > groundY) {
    mickyY = groundY;
    mVy = 0;
    mOnGround = true;
  } else {
    mOnGround = false;
  }

  // update and draw micky (uses its own position)
  if (mickyFrames.length > 0) {
    if (millis() - mickyLastFrameTime > MICKY_INTERVAL) {
      mickyFrame = (mickyFrame + 1) % MICKY_TOTAL;
      mickyLastFrameTime = millis();
    }

    const mimg = mickyFrames[mickyFrame];
    // scale micky so its height is proportional to main displayH
    const mScale = 0.8; // relative size compared to main character
    const mDisplayH = displayH * mScale;
    const mDisplayW = (mimg.width / mimg.height) * mDisplayH;

    // store last display size for proximity checks later
    mDisplayWCurrent = mDisplayW;
    mDisplayHCurrent = mDisplayH;

    // Constrain micky within canvas
    mickyX = constrain(mickyX, mDisplayW / 2, width - mDisplayW / 2);

    // image uses center, so pass mickyX and mickyY
    image(mimg, mickyX, mickyY, mDisplayW, mDisplayH);
  }
  // draw right-side character (static-ish, uses its own frames)
  if (rightFrames.length > 0) {
    if (millis() - rightLastFrameTime > RIGHT_INTERVAL) {
      rightFrame = (rightFrame + 1) % RIGHT_TOTAL;
      rightLastFrameTime = millis();
    }
    const rimg = rightFrames[rightFrame];
    const rScale = 0.9;
    const rDisplayH = displayH * rScale;
    const rDisplayW = (rimg.width / rimg.height) * rDisplayH;
    rDisplayWCurrent = rDisplayW;
    rDisplayHCurrent = rDisplayH;
    // ensure right character constrained inside canvas
    rightX = constrain(rightX, rDisplayW / 2, width - rDisplayW / 2);
    image(rimg, rightX, rightY, rDisplayW, rDisplayH);
  }
  // draw left-far character (角色4)
  if (leftFarFrames.length > 0) {
    if (millis() - leftFarLastFrameTime > LEFTFAR_INTERVAL) {
      leftFarFrame = (leftFarFrame + 1) % LEFTFAR_TOTAL;
      leftFarLastFrameTime = millis();
    }
    const lfimg = leftFarFrames[leftFarFrame];
    const lfScale = 0.75;
    const lfDisplayH = displayH * lfScale;
    const lfDisplayW = (lfimg.width / lfimg.height) * lfDisplayH;
    lfDisplayWCurrent = lfDisplayW;
    lfDisplayHCurrent = lfDisplayH;
    // ensure left-far character constrained inside canvas
    leftFarX = constrain(leftFarX, lfDisplayW / 2, width - lfDisplayW / 2);
    image(lfimg, leftFarX, leftFarY, lfDisplayW, lfDisplayH);
  }
  // Movement: left/right
  if (keyIsDown(LEFT_ARROW)) {
    playerX -= moveSpeed;
  }
  if (keyIsDown(RIGHT_ARROW)) {
    playerX += moveSpeed;
  }

  // Apply gravity
  vy += gravity;
  playerY += vy;

  // Ground collision
  if (playerY > groundY) {
    playerY = groundY;
    vy = 0;
    onGround = true;
  } else {
    onGround = false;
  }

  // Constrain player within canvas
  playerX = constrain(playerX, displayW / 2, width - displayW / 2);

  // Draw character at player position
  image(img, playerX, playerY, displayW, displayH);

  // Show dialog box above micky when close to main player
  // compute current micky display sizes (fallback if not set)
  if (typeof mDisplayWCurrent === 'undefined') {
    mDisplayHCurrent = displayH * 0.8;
    mDisplayWCurrent = (21 / 30) * mDisplayHCurrent;
  }
  const distance = dist(playerX, playerY, mickyX, mickyY);
  const proximityThreshold = displayW / 2 + mDisplayWCurrent / 2 + 40;

  // Open input when approaching (only if not yet submitted)
  if (!inputSubmitted && distance < proximityThreshold) {
    if (!inputActive) {
      inputActive = true;
      inputText = '';
    }
    if (!mickyDialogText && !leftFarDialogText && !showingCompletionMessage) {
      // choose a question based on progress
      // first do math (micky), then english (character 4)
      if (!mathCompleted) {
        // select a math question for micky
        const mathQuestions = questions.filter(q => !q.題型 || q.題型 === 'math');
        if (mathQuestions.length > 0) {
          currentQuestionIndex = floor(random(0, mathQuestions.length));
          const qobj = mathQuestions[currentQuestionIndex];
          mickyDialogText = qobj && qobj.題目 ? qobj.題目 : '請問你叫甚麼名字';
          currentQuestionType = 'math';
          // find the index in main questions array
          currentQuestionIndex = questions.indexOf(qobj);
        } else {
          mickyDialogText = '請問你叫甚麼名字';
        }
      } else if (!englishCompleted) {
        // select an english question for character 4
        const englishQuestions = questions.filter(q => q.題型 === 'english');
        if (englishQuestions.length > 0) {
          const randIdx = floor(random(0, englishQuestions.length));
          const qobj = englishQuestions[randIdx];
          leftFarDialogText = qobj && qobj.題目 ? qobj.題目 : '請說出這個英文單字';
          currentQuestionType = 'english';
          // find the index in main questions array
          currentQuestionIndex = questions.indexOf(qobj);
        } else {
          leftFarDialogText = '請說出這個英文單字';
        }
      } else {
        // both completed: show message
        mickyDialogText = '都答對了！很棒！';
      }
    }
  }

  // Determine whether to show micky's dialog: show when input open (typing) or when close (or after submit)
  const showMickyDialog = (inputActive || (!inputSubmitted && distance < proximityThreshold) || (inputSubmitted && mickyDialogText));
  if (showMickyDialog && mickyDialogText) {
    push();
    textSize(18);
    textAlign(CENTER, CENTER);
    const padding = 10;
    const tw = textWidth(mickyDialogText);
    const boxW = tw + padding * 2;
    const boxH = 26 + padding;
    const boxX = mickyX;
    const boxY = mickyY - mDisplayHCurrent / 2 - boxH / 2 - 8;
    rectMode(CENTER);
    fill(255, 245);
    stroke(0);
    strokeWeight(2);
    rect(boxX, boxY, boxW, boxH, 6);
    noStroke();
    fill(0);
    text(mickyDialogText, boxX, boxY);
    pop();
  }

  // show right character dialog when available
  if (rightDialogText) {
    push();
    textSize(18);
    textAlign(CENTER, CENTER);
    const padding = 10;
    const tw = textWidth(rightDialogText);
    const boxW = tw + padding * 2;
    const boxH = 26 + padding;
    const boxX = rightX;
    const boxY = rightY - rDisplayHCurrent / 2 - boxH / 2 - 8;
    rectMode(CENTER);
    fill(255, 245);
    stroke(0);
    strokeWeight(2);
    rect(boxX, boxY, boxW, boxH, 6);
    noStroke();
    fill(0);
    text(rightDialogText, boxX, boxY);
    pop();
  }

  // show left-far character dialog when available
  if (leftFarDialogText) {
    push();
    textSize(18);
    textAlign(CENTER, CENTER);
    const padding = 10;
    const tw = textWidth(leftFarDialogText);
    const boxW = tw + padding * 2;
    const boxH = 26 + padding;
    const boxX = leftFarX;
    const boxY = leftFarY - lfDisplayHCurrent / 2 - boxH / 2 - 8;
    rectMode(CENTER);
    fill(255, 245);
    stroke(0);
    strokeWeight(2);
    rect(boxX, boxY, boxW, boxH, 6);
    noStroke();
    fill(0);
    text(leftFarDialogText, boxX, boxY);
    pop();
  }

  // show "press enter for next" hint when showing completion message
  if (showingCompletionMessage) {
    push();
    fill(100, 150);
    textAlign(CENTER, TOP);
    textSize(14);
    text('按 ENTER 進入下一題', width / 2, height - 60);
    pop();
  }

  // If input is active, show an input box above the middle (player) character.
  if (inputActive) {
    push();
    // keep input box vertically stable (don't jump when player jumps): anchor relative to ground
    const iboxX = playerX;
    const iboxY = groundY - displayH / 2 - 60;
    const padding = 8;
    textSize(18);
    textAlign(LEFT, CENTER);
    const tw = textWidth(inputText || ' ');
    const boxW = max(160, tw + padding * 2 + 12);
    const boxH = 32;
    rectMode(CENTER);
    fill(255);
    stroke(0);
    strokeWeight(2);
    rect(iboxX, iboxY, boxW, boxH, 6);
    noStroke();
    fill(0);
    // draw the typed text left-aligned inside the box
    const textX = iboxX - boxW / 2 + padding + 4;
    text(inputText, textX, iboxY);
    // draw a caret at end (non-blinking)
    const caretX = textX + textWidth(inputText);
    stroke(0);
    strokeWeight(2);
    line(caretX + 2, iboxY - 10, caretX + 2, iboxY + 10);
    pop();
  }

  // Draw simple ground indicator
  push();
  stroke(0, 60);
  strokeWeight(2);
  line(0, groundY + displayH / 2 + 10, width, groundY + displayH / 2 + 10);
  pop();

  // If sound not yet started, show a small hint to click/tap to enable audio
  if (y848sound && !soundPlaying) {
    push();
    fill(0, 150);
    textAlign(CENTER, BOTTOM);
    textSize(14);
    text('點擊或按任意鍵以播放音效', width / 2, height - 20);
    pop();
  }

  // update and draw ticket particles (draw behind UI elements so they look like background effects)
  for (let i = tickets.length - 1; i >= 0; i--) {
    const p = tickets[i];
    p.vy += TICKET_GRAVITY;
    p.x += p.vx;
    p.y += p.vy;
    p.life -= 1;
    push();
    translate(p.x, p.y);
    rotate(p.rot);
    rectMode(CENTER);
    noStroke();
    fill(p.color);
    rect(0, 0, p.w, p.h, 4);
    fill(0);
    textAlign(CENTER, CENTER);
    textSize(10);
    text('彩票', 0, 0);
    pop();
    if (p.life <= 0 || p.y > height + 50) tickets.splice(i, 1);
  }

  // auto-advance when timer elapsed
  if (showingCompletionMessage && nextQuestionTimer > 0 && millis() >= nextQuestionTimer) {
    // reset timer and prepare for next question
    nextQuestionTimer = 0;
    showingCompletionMessage = false;
    inputActive = true;
    inputText = '';
    inputSubmitted = false;
    mickyDialogText = '';
    leftFarDialogText = '';
    rightDialogText = '';
    // allow draw() selection logic to pick the next question
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  // update ground and keep player on ground if they were standing
  groundY = height - displayH / 2 - 20;
  if (onGround) {
    playerY = groundY;
  }
  if (mOnGround) {
    mickyY = groundY;
  }
}

function mousePressed() {
  // Start audio in response to user gesture to satisfy browser autoplay policies
  if (y848sound && !soundPlaying) {
    userStartAudio();
    // play once or loop; change to .loop() if you want continuous playback
    y848sound.play();
    soundPlaying = true;
  }
}

// emit N ticket particles from (x,y)
function emitTickets(x, y, n = 30) {
  for (let i = 0; i < n; i++) {
    const angle = random(-PI * 0.9, -PI * 0.1);
    const speed = random(2, 8);
    const vx = cos(angle) * speed + random(-1, 1);
    const vy = sin(angle) * speed + random(-1, 1);
    const sizeW = random(18, 34);
    const sizeH = random(12, 20);
    tickets.push({
      x: x + random(-20, 20),
      y: y + random(-10, 10),
      vx: vx,
      vy: vy,
      w: sizeW,
      h: sizeH,
      rot: random(-0.5, 0.5),
      life: Math.floor(random(60, 140)),
      color: color(random(200, 255), random(160, 240), random(80, 220))
    });
  }
}

function keyPressed() {
  // also allow keyboard to start sound
  if (y848sound && !soundPlaying) {
    userStartAudio();
    y848sound.play();
    soundPlaying = true;
  }
  // Jump on Space (only if on ground)
  if ((key === ' ' || keyCode === 32) && onGround) {
    vy = jumpForce;
    onGround = false;
  }
  // Micky jump on 'W' or 'w'
  if ((key === 'w' || key === 'W' || keyCode === 87) && mOnGround) {
    mVy = mJumpForce;
    mOnGround = false;
  }

  // If we are showing the "press enter for next" message, allow Enter to advance
  if ((keyCode === ENTER || keyCode === 13) && showingCompletionMessage) {
    showingCompletionMessage = false;
    inputActive = true;
    inputText = '';
    inputSubmitted = false;
    mickyDialogText = '';
    leftFarDialogText = '';
    rightDialogText = '';
    // next question will be selected in draw()
    return false; // consume the key
  }

  // Input handling: when input box active, handle Enter and Backspace here
  if (inputActive) {
    // Enter: submit or next question
    if (keyCode === ENTER || keyCode === 13) {
      // if showing completion message, pressing Enter proceeds to next question
      if (showingCompletionMessage) {
        showingCompletionMessage = false;
        inputActive = true;
        inputText = '';
        inputSubmitted = false;
        mickyDialogText = '';
        leftFarDialogText = '';
        rightDialogText = '';
        // next question will be selected in draw() when both dialogs are empty
        return false;
      }
      
      // check against current question's answer (if any)
      const userAns = inputText.trim();
      if (currentQuestionIndex >= 0 && questions[currentQuestionIndex]) {
        const expectedRaw = (questions[currentQuestionIndex].答案 || '').toString().trim();
        // allow numeric comparison if both look numeric
        const userNum = Number(userAns);
        const expNum = Number(expectedRaw);
        const isNumericCompare = !isNaN(userNum) && !isNaN(expNum);
        const correct = isNumericCompare ? (userNum === expNum) : (userAns === expectedRaw);
        if (correct) {
          // correct answer
          const emitX = width / 2;
          const emitY = groundY - displayH / 2 - 40;
          emitTickets(emitX, emitY, 40);
          
          if (currentQuestionType === 'english') {
            // english: show success in left-far character dialog
            leftFarDialogText = '答對了好棒';
            englishCompleted = true;
          } else {
            // math: show success in micky (left) character dialog
            mickyDialogText = '答對了好棒';
            mathCompleted = true;
          }
          // clear right hint if any
          rightDialogText = '';
          inputSubmitted = true;
          inputActive = false;
          showingCompletionMessage = true;
          // schedule auto-advance in 1 second
          nextQuestionTimer = millis() + 1000;
        } else {
          // incorrect: show hint in right character dialog and keep input active for retry
          rightDialogText = questions[currentQuestionIndex].提示 || '答錯了，再試一次';
          inputSubmitted = false;
          inputActive = true;
        }
      } else {
        // no current question: fallback behaviour (same as before)
        mickyDialogText = (inputText.trim() || '') + ' 歡迎你';
      }
    } else if (keyCode === BACKSPACE || keyCode === 8) {
      // remove last character
      inputText = inputText.slice(0, -1);
    }
    // prevent other handlers from acting on this keypress (but still allow movement keys via keyIsDown)
  }
}

function keyTyped() {
  // capture printable characters for input when inputActive
  if (inputActive) {
    // key contains the typed character
    if (key && key.length === 1) {
      inputText += key;
    }
    // prevent default
    return false;
  }
}
