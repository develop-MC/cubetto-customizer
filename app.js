document.addEventListener("DOMContentLoaded", function(){

/* ===== BLE ===== */

let bleDevice = null;
let bleServer = null;
let bleTx = null;
let bleRx = null;
let seq = 0;
let isConnected = false;
let isDefaultPreview = false;

function setConnected(state){
  const status = document.getElementById("connectionStatus");

  if(state){
    status.classList.add("connected");
    status.innerHTML = `<div class="status-dot"></div>Connected`;
  }else{
    status.classList.remove("connected");
    status.innerHTML = `<div class="status-dot"></div>Not connected`;
  }
}

function updateConnectButton(){
  const btn = document.getElementById("connect");

  if(isConnected){
    btn.textContent = "Disconnect";
    btn.style.background = "#d60000";
  }else{
    btn.textContent = "Connect";
    btn.style.background = "#2e9d45";
  }
}

async function connectCubetto(){
  try{
    bleDevice = await navigator.bluetooth.requestDevice({
      filters:[{ name:"PRIMO INTERFACE" }],
      optionalServices:[
        "0000fff0-0000-1000-8000-00805f9b34fb",
        "02f00000-0000-0000-0000-00000000fe00"
      ]
    });

    bleServer = await bleDevice.gatt.connect();

    const service = await bleServer.getPrimaryService(
      "0000fff0-0000-1000-8000-00805f9b34fb"
    );

    bleTx = await service.getCharacteristic(
      "0000fff1-0000-1000-8000-00805f9b34fb"
    );

    bleRx = await service.getCharacteristic(
      "0000fff4-0000-1000-8000-00805f9b34fb"
    );

    await bleRx.startNotifications();

    bleRx.addEventListener("characteristicvaluechanged", (e)=>{
      const v = new Uint8Array(e.target.value.buffer);
      console.log("RX:", v);
    });

    await bleTx.writeValue(new Uint8Array([0x08,0x00,0x01,0x06]));

    isConnected = true;
    setConnected(true);
    updateConnectButton();

    bleDevice.addEventListener("gattserverdisconnected", ()=>{
      isConnected = false;
      setConnected(false);
      updateConnectButton();
    });

  }catch(err){
    console.error(err);
    alert("Connection failed");
  }
}

function disconnectCubetto(){
  if(bleDevice?.gatt.connected){
    bleDevice.gatt.disconnect();
  }

  bleTx = null;
  bleRx = null;
  isConnected = false;

  setConnected(false);
  updateConnectButton();
}

document.getElementById("connect").onclick = ()=>{
  isConnected ? disconnectCubetto() : connectCubetto();
};

/* ===== MAPS ===== */

const commandMap = {
  right: 0x01,
  left: 0x02,
  random: 0x03,
  forward: 0x04,
  function: 0x05,
  negation: 0x06,
  back: 0x07,
  speed: 0x09
};

const repeatMap = {1:0x11,2:0x12,3:0x13,4:0x14,5:0x15};
const speedValueMap = {slow:0x11,normal:0x12,fast:0x13};

const readableMap = {
  forward: "Forward",
  back: "Backward",
  left: "Turn Left",
  right: "Turn Right",
  random: "Random",
  function: "Function",
  negation: "Negation"
};

const speedReadable = {
  slow: "Slow",
  normal: "Normal",
  fast: "Fast"
};

/* ===== HELPERS ===== */

function stepsToText(steps){
  return steps.map(s => {
    const name = readableMap[s.type];
    return `${s.count}× ${name}`;
  }).join(" → ");
}

/* ===== SIMULATOR ===== */

let robot = { x: 2, y: 2, dir: "N" };

function resetRobot(){
  robot = { x: 2, y: 2, dir: "N" };
}

function rotateLeft(dir){
  return {N:"W", W:"S", S:"E", E:"N"}[dir];
}

function rotateRight(dir){
  return {N:"E", E:"S", S:"W", W:"N"}[dir];
}

function stepRobot(step){

  if(step === "forward"){
    if(robot.dir === "N") robot.y--;
    if(robot.dir === "S") robot.y++;
    if(robot.dir === "E") robot.x++;
    if(robot.dir === "W") robot.x--;
  }

  if(step === "back"){
    if(robot.dir === "N") robot.y++;
    if(robot.dir === "S") robot.y--;
    if(robot.dir === "E") robot.x--;
    if(robot.dir === "W") robot.x++;
  }

  if(step === "left"){
    robot.dir = rotateLeft(robot.dir);
     renderGrid();
  }

  if(step === "right"){
    robot.dir = rotateRight(robot.dir);
     renderGrid();
  }

  // clamp (aby nevyjel z gridu)
  robot.x = Math.max(0, Math.min(4, robot.x));
  robot.y = Math.max(0, Math.min(4, robot.y));
}

function expandSteps(blocks){
  const result = [];

  blocks.forEach(s=>{
    for(let i=0;i<s.count;i++){
      result.push(s.type);
    }
  });

  return result;
}

function renderGrid(){

  const grid = document.getElementById("grid");
  if(!grid) return;

  grid.innerHTML = "";

  for(let y=0; y<5; y++){
    for(let x=0; x<5; x++){

      const cell = document.createElement("div");
      cell.className = "cell";

if(x === robot.x && y === robot.y){

  const arrow = document.createElement("div");
  arrow.className = "robot-arrow";

  // 🔥 rotace
  let rotation = 0;

  if(robot.dir === "N") rotation = 0;
  if(robot.dir === "E") rotation = 90;
  if(robot.dir === "S") rotation = 180;
  if(robot.dir === "W") rotation = 270;

  arrow.style.transform = `rotate(${rotation}deg)`;

  cell.appendChild(arrow);
}

      grid.appendChild(cell);
    }
  }
}

async function playSimulation(){

  console.log("SIM START");
  resetRobot();
  renderGrid();

  // vezme všechny upravené bloky (nebo fallback)
  const activeBlocks = Object.keys(blocks).filter(id => state.dirty[id]);

  const sequence = activeBlocks.length > 0
    ? activeBlocks.flatMap(id => expandSteps(state.blocks[id]))
    : expandSteps([{type:"forward", count:1}]); // fallback

  // malý delay pro UX
  await new Promise(r => setTimeout(r, 200));

  for(const step of sequence){
    stepRobot(step);
    renderGrid();
    await new Promise(r => setTimeout(r, 400));
  }
}

function simulateBlock(id){

  console.log("SIM BLOCK:", id);

  // 🔥 simulátor (mimo modal!)
  const sim = document.getElementById("simulator");
  const grid = document.getElementById("grid");

  if(!sim || !grid){
    console.error("Simulator not found");
    return;
  }

  // 🔥 zobraz simulátor
  sim.style.display = "flex";
  grid.style.display = "grid";

  // 🔥 reset + první render
  resetRobot();
  renderGrid();

  // 🔥 jen tento blok
  const steps = expandSteps(state.blocks[id]);

  let delay = 500;

steps.forEach(step=>{

  // 🔥 nejdřív rotace (pokud je)
  if(step === "left" || step === "right"){

    setTimeout(()=>{
      stepRobot(step);   // změní směr
      renderGrid();      // zobraz otočení
    }, delay);

    delay += 500; // čas aby bylo vidět otočení
  }

  // 🔥 pak pohyb
  else{

    setTimeout(()=>{
      stepRobot(step);
      renderGrid();
    }, delay);

    delay += 800;
  }

});
}

/* ===== STATE ===== */

const blocks={
  forward:{name:"Forward"},
  back:{name:"Backward"},
  left:{name:"Turn Left"},
  right:{name:"Turn Right"},
  random:{name:"Random"},
  function:{name:"Function"},
  negation:{name:"Negation"}
};

const layoutLeft=["speed","left","back","random"];
const layoutRight=["forward","right","negation","function"];

const state={
  speed:"normal",
  dirty:{},
  blocks:Object.fromEntries(
    Object.keys(blocks).map(id=>[id,[{type:id,count:1}]])
  )
};

/* ===== PACKET ===== */

function buildPacket(moduleId, steps){
  const bytes = [0xAA,0x55,seq++ & 0xFF,0x20,commandMap[moduleId]];
  steps.forEach(s=>{
    bytes.push(s.command);
    bytes.push(s.number);
  });
  bytes.push(0x00);
  return new Uint8Array(bytes);
}

async function sendPacket(moduleId, steps){
  if(!bleTx) return alert("Not connected");
  await bleTx.writeValue(buildPacket(moduleId, steps));
}

/* ===== UI ===== */

const left=document.getElementById("left");
const right=document.getElementById("right");

function createSpeedTile(){

  const isDirty = state.dirty["speed"];
  const card=document.createElement("div");
  card.className="block" + (isDirty ? "" : " locked");

  card.innerHTML=`
    <div class="block-header">
      <div class="block-info">
        <div class="block-name">Robot Speed</div>
        <img class="block-icon" src="./assets/blocks/speed_icon.png">
      </div>
      <div class="speed-control">
        <div class="speed-option ${state.speed==="slow"?"active":""}" data-v="slow">SLOW</div>
        <div class="speed-option ${state.speed==="normal"?"active":""}" data-v="normal">NORMAL</div>
        <div class="speed-option ${state.speed==="fast"?"active":""}" data-v="fast">FAST</div>
      </div>
    </div>
  `;

  const modifyBtn=document.createElement("button");
  modifyBtn.className="modify-btn";
  modifyBtn.textContent = isDirty ? "Editing ✕" : "Modify";

  modifyBtn.onclick=()=>{
    if(isDirty){
      delete state.dirty["speed"];
      state.speed="normal";
    }else{
      state.dirty["speed"]=true;
    }
    render();
  };

  card.querySelector(".block-info").appendChild(modifyBtn);

  if(isDirty){
    card.querySelectorAll(".speed-option").forEach(b=>{
      b.onclick=()=>{ state.speed=b.dataset.v; render(); };
    });
  }

  card.addEventListener("click",(e)=>{
    if(e.target.closest("button")) return;
    if(!state.dirty["speed"]){
      state.dirty["speed"]=true;
      render();
    }
  });

  return card;
}

function createBlockCard(id){

  const isDirty = state.dirty[id];

  const card=document.createElement("div");
  card.className="block " + (isDirty ? "" : "locked");

  const header=document.createElement("div");
  header.className="block-header content";
  header.style.display = "flex";
  header.style.justifyContent = "space-between";
  header.style.alignItems = "flex-start";

  // LEFT (icon + modify pod sebou)
  const info=document.createElement("div");
  info.className="block-info";

  info.style.display = "flex";
  info.style.flexDirection = "column";
  info.style.alignItems = "flex-start";
  info.style.gap = "10px";

  info.innerHTML=`
    <img class="block-icon" src="./assets/blocks/block_${id}.png">
  `;

  const modifyBtn=document.createElement("button");
  modifyBtn.className="modify-btn";
  modifyBtn.textContent = isDirty ? "Editing ✕" : "Modify";

  modifyBtn.onclick=()=>{
    if(isDirty){
      delete state.dirty[id];
      state.blocks[id] = [{type:id,count:1}];
    }else{
      state.dirty[id]=true;
    }
    render();
  };

// 🔥 PLAY BUTTON
const playBtn = document.createElement("button");
const previewText = document.createElement("div");
previewText.className = "preview-inline";
previewText.textContent = stepsToText(state.blocks[id]);
playBtn.className = "play-btn";
playBtn.textContent = "▶ Simulator";

playBtn.onclick = ()=>{
  console.log("CLICK", id); // 🔥 debug
  simulateBlock(id);
};

// 🔥 wrapper pro Editing + Play
const actions = document.createElement("div");
actions.style.display = "flex";
actions.style.gap = "8px";
actions.style.alignItems = "center";

actions.appendChild(modifyBtn);

// ❌ playBtn pryč zleva
info.appendChild(actions);

// RIGHT (sequence pod tlačítkem)
const headerRight = document.createElement("div");
headerRight.className = "block-right"; // 🔥 KLÍČOVÉ

headerRight.style.display = "flex";
headerRight.style.flexDirection = "column";
headerRight.style.alignItems = "flex-end";
headerRight.style.gap = "10px";

  const seqDiv=document.createElement("div");
  seqDiv.className="sequence";

  state.blocks[id].forEach((step,idx)=>{

    const line=document.createElement("div");
    line.className="step";

    const select=document.createElement("select");
    select.className="selector-dropdown";
    select.disabled=!isDirty;

  const allowedSteps = ["forward","back","left","right"];

  allowedSteps.forEach(b=>{
    const o=document.createElement("option");
    o.value=b;
    o.textContent=blocks[b].name;
    if(b===step.type) o.selected=true;
    select.appendChild(o);
  });

    select.onchange=()=>{ step.type=select.value; };

    const minus=document.createElement("button");
    minus.className="btn-minus";
    minus.textContent="−";
    minus.disabled=!isDirty;
    minus.onclick=()=>{ if(step.count>1){ step.count--; render(); } };

    const count=document.createElement("span");
    count.textContent=step.count;

    const plus=document.createElement("button");
    plus.className="btn-plus";
    plus.textContent="+";
    plus.disabled=!isDirty;
    plus.onclick=()=>{ if(step.count<5){ step.count++; render(); } };

    const remove=document.createElement("button");
    remove.className="btn-remove";
    remove.textContent="✕";
    remove.disabled=!isDirty;
    remove.onclick=()=>{ state.blocks[id].splice(idx,1); render(); };

    line.append(select,minus,count,plus,remove);
    seqDiv.appendChild(line);
  });

  const add=document.createElement("button");
  add.className="add-step";
  add.textContent="+ Add step";
  add.disabled=!isDirty;
  add.onclick=()=>{ state.blocks[id].push({type:id,count:1}); render(); };

  seqDiv.appendChild(add);

headerRight.appendChild(playBtn);
headerRight.appendChild(previewText);
headerRight.appendChild(seqDiv);
  header.append(info, headerRight);
  card.appendChild(header);

  card.addEventListener("click", (e)=>{
    if(e.target.closest("button") || e.target.closest("select")) return;

    if(!state.dirty[id]){
      state.dirty[id]=true;
      render();
    }
  });

  return card;
}

function render(){
  left.innerHTML="";
  right.innerHTML="";

  layoutLeft.forEach(id=>{
    id==="speed"
      ? left.appendChild(createSpeedTile())
      : left.appendChild(createBlockCard(id));
  });

  layoutRight.forEach(id=>{
    right.appendChild(createBlockCard(id));
  });
}

/* ===== PREVIEW ===== */

function generatePreview(){

  const preview = document.getElementById("preview");
  preview.innerHTML = "";

  // 🔹 DEFAULT PREVIEW
  if(isDefaultPreview){

    // speed
    preview.appendChild(
      createPreviewItem(
        "speed",
        "Speed",
        speedReadable["normal"]
      )
    );

    // blocks
    Object.keys(blocks).forEach(id=>{
      preview.appendChild(
        createPreviewItem(
          id,
          blocks[id].name,
          `1× ${readableMap[id]}`
        )
      );
    });

    return;
  }

  // 🔹 CUSTOM PREVIEW

  // speed
  if(state.dirty["speed"]){
    preview.appendChild(
      createPreviewItem(
        "speed",
        "Speed",
        speedReadable[state.speed]
      )
    );
  }

  // blocks
  Object.keys(blocks)
    .filter(id=>state.dirty[id])
    .forEach(id=>{

      const text = stepsToText(state.blocks[id]);

      preview.appendChild(
        createPreviewItem(
          id,
          blocks[id].name,
          text
        )
      );

    });
}

/* ===== PREVIEW ITEM ===== */

function createPreviewItem(id, name, text){

  const item = document.createElement("div");
  item.className = "preview-item";

  item.innerHTML = `
    <img class="preview-icon" src="${
      id==="speed"
        ? "./assets/blocks/speed_icon.png"
        : `./assets/blocks/block_${id}.png`
    }">
    <div class="preview-content">
      <div class="preview-title">${name}</div>
      <div class="preview-text">${text}</div>
    </div>
  `;

  return item;
}

/* ===== EVENTS ===== */

// OPEN
document.getElementById("infoBtn").onclick = ()=>{
  document.getElementById("infoModal").style.display = "flex";
};

// CLOSE (X)
document.getElementById("infoClose").onclick = ()=>{
  document.getElementById("infoModal").style.display = "none";
};

// CLOSE (klik mimo)
document.getElementById("infoModal").onclick = (e)=>{
  if(e.target.id === "infoModal"){
    e.target.style.display = "none";
  }
};

document.getElementById("upload").onclick = ()=>{
  isDefaultPreview = false;

  generatePreview();
  document.getElementById("modal").style.display = "flex";
};

document.getElementById("defaults").onclick = ()=>{
  isDefaultPreview = true;

  generatePreview();
  document.getElementById("modal").style.display = "flex";

document.getElementById("grid").style.display = "none";
};

document.getElementById("print").onclick = ()=>{
  window.print();
};

document.getElementById("modalClose").onclick = ()=>{
  document.getElementById("modal").style.display = "none";

  
  // optional reset simulace
  resetRobot();
  renderGrid();
};

document.getElementById("confirmUpload").onclick = async ()=>{

  const btn = document.getElementById("confirmUpload");
  btn.classList.add("loading");

  // 🔥 START loading
  btn.disabled = true;
  btn.textContent = "Uploading...";

  try{

    if(!bleTx){
      alert("Connect first");
      return;
    }

    // 🔹 DEFAULT UPLOAD
    if(isDefaultPreview){

      await sendPacket("speed",[{
        command:commandMap.speed,
        number:speedValueMap["normal"]
      }]);

      for(const id of Object.keys(blocks)){
        await sendPacket(id,[{
          command:commandMap[id],
          number:repeatMap[1]
        }]);
        await new Promise(r=>setTimeout(r,120));
      }

      alert("Default uploaded");
      document.getElementById("modal").style.display = "none";
      return;
    }

    // 🔹 CUSTOM UPLOAD
    const changed = Object.keys(blocks).filter(id=>state.dirty[id]);

    if(changed.length === 0){
      alert("Nothing to upload");
      return;
    }

    for(const id of changed){
      await sendPacket(
        id,
        state.blocks[id].map(s=>({
          command:commandMap[s.type],
          number:repeatMap[s.count]
        }))
      );

      await new Promise(r=>setTimeout(r,120));
    }

    alert("Uploaded");
    document.getElementById("modal").style.display = "none";

  } finally {
  btn.disabled = false;
  btn.textContent = "Upload";
  btn.classList.remove("loading"); // 🔥 TADY
}
};

/* ===== SIMULATOR CLOSE ===== */

document.getElementById("simClose").onclick = ()=>{
  document.getElementById("simulator").style.display = "none";
};

/* ===== SIMULATOR CLOSE (click outside) ===== */

document.getElementById("simulator").onclick = (e)=>{
  if(e.target.id === "simulator"){
    e.currentTarget.style.display = "none";
  }
};

document.getElementById("simulator").style.display = "none";

/* ===== INIT ===== */

state.dirty = {};
render();

// auto-open help popup
document.getElementById("infoModal").style.display = "flex";

});