import * as THREE from 'three';
import { Chess } from 'chess.js';

const $ = id => document.getElementById(id);
const canvas = $('gameCanvas');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101b27);
scene.fog = new THREE.Fog(0x101b27, 18, 48);
const camera = new THREE.PerspectiveCamera(52, 1, .1, 120);
const renderer = new THREE.WebGLRenderer({canvas,antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
scene.add(new THREE.HemisphereLight(0xc9e5ff,0x29303a,2));
const sun = new THREE.DirectionalLight(0xffe4bd,3.2); sun.position.set(-8,14,7); sun.castShadow=true; sun.shadow.mapSize.set(2048,2048); scene.add(sun);
const fill = new THREE.DirectionalLight(0x6da9ff,1.2); fill.position.set(8,5,-8); scene.add(fill);
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const clock = new THREE.Clock();
const chess = new Chess();
let mode='board', selected=null, legalTargets=[], squares=[], pieceMeshes=[], activePiece=null, pendingMove=null, battle=null;
let yaw=0,pitch=0,keys={},velocity=new THREE.Vector3(),locked=false,player=null,opponent=null,projectiles=[],effects=[],lastAttack=0,lastAbility={E:0,R:0};
const mats={light:new THREE.MeshStandardMaterial({color:0xd7c6a4,roughness:.8}),dark:new THREE.MeshStandardMaterial({color:0x34475a,roughness:.75}),white:new THREE.MeshStandardMaterial({color:0xe9e4d8,roughness:.35,metalness:.12}),black:new THREE.MeshStandardMaterial({color:0x242b35,roughness:.32,metalness:.2}),gold:new THREE.MeshStandardMaterial({color:0xc99a48,metalness:.65,roughness:.25}),accent:new THREE.MeshStandardMaterial({color:0x8bd65c,emissive:0x294d16,emissiveIntensity:.6}),red:new THREE.MeshStandardMaterial({color:0xc94d53,emissive:0x3c090d,emissiveIntensity:.4})};
const pieceInfo={
p:{name:'PAWN',hp:90,speed:6,damage:17,description:'A nimble frontline fighter. E summons two decoys; R throws a returning blade.',icon:'♟'},
n:{name:'KNIGHT',hp:125,speed:7.2,damage:20,description:'A mobile ranged fighter. E fires a rapid arrow volley; R launches a grappling tether.',icon:'♞'},
b:{name:'BISHOP',hp:95,speed:6.3,damage:22,description:'A spellcaster. E releases a burst of arcane energy; R blinks a short distance.',icon:'♝'},
r:{name:'ROOK',hp:175,speed:4.5,damage:27,description:'A heavy defender. E raises a temporary barrier; R performs a powerful forward charge.',icon:'♜'},
q:{name:'QUEEN',hp:115,speed:6.5,damage:25,description:'A versatile duelist. E sends an energy wave; R performs a swift dash.',icon:'♛'},
k:{name:'KING',hp:145,speed:5.3,damage:24,description:'A balanced leader. E activates a protective aura; R delivers a royal shockwave.',icon:'♚'}
};
function toast(msg){const el=$('toast');el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),1900)}
function clearWorld(){for(const o of [...scene.children]){if(o.isMesh||o.isGroup||o.isLine){scene.remove(o);disposeObject(o)}}squares=[];pieceMeshes=[];effects=[];projectiles=[];player=null;opponent=null}
function disposeObject(o){o.traverse?.(x=>{x.geometry?.dispose();if(x.material&&!Array.isArray(x.material))x.material.dispose()})}
function makeBox(w,h,d,mat,x,y,z){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;return m}
function boardPos(file,rank){return new THREE.Vector3(file-3.5,.18,3.5-rank)}
function buildBoard(){
 clearWorld();scene.background.set(0x101b27);scene.fog=new THREE.Fog(0x101b27,18,48);
 const floor=makeBox(24,.5,24,new THREE.MeshStandardMaterial({color:0x182330,roughness:.95}),0,-.55,0);scene.add(floor);
 const base=makeBox(9,.42,9,new THREE.MeshStandardMaterial({color:0x4b3929,roughness:.55}),0,-.08,0);scene.add(base);
 for(let r=0;r<8;r++)for(let f=0;f<8;f++){const mat=(r+f)%2?mats.dark:mats.light;const tile=makeBox(1,.16,1,mat,f-3.5,.16,3.5-r);tile.userData={type:'square',file:f,rank:r};scene.add(tile);squares.push(tile)}
 const edgeMat=new THREE.MeshStandardMaterial({color:0x927044,metalness:.55,roughness:.4});
 for(let i=0;i<4;i++){const rail=makeBox(9,.2,.18,edgeMat,0,.28,i<2?-4.5:4.5);scene.add(rail)}
 drawPieces();camera.position.set(0,8.8,10.5);camera.lookAt(0,0,0);yaw=0;pitch=-.52;
}
function makeChessPiece(type,color){
 const group=new THREE.Group();const body=color==='w'?mats.white:mats.black;const trim=color==='w'?mats.gold:new THREE.MeshStandardMaterial({color:0x718397,metalness:.55,roughness:.3});
 const cyl=(rt,rb,h,y,mat)=>{const m=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,20),mat);m.position.y=y;m.castShadow=true;group.add(m)};
 cyl(.31,.36,.12,.13,trim);cyl(.22,.29,.18,.27,body);
 if(type==='p'){cyl(.14,.19,.28,.48,body);const head=new THREE.Mesh(new THREE.SphereGeometry(.17,18,14),body);head.position.y=.72;group.add(head)}
 if(type==='r'){cyl(.2,.23,.42,.55,body);cyl(.28,.2,.12,.83,trim);for(let i=0;i<4;i++){const b=makeBox(.12,.18,.12,body,0,0,0);const a=i*Math.PI/2;b.position.set(Math.cos(a)*.18,.97,Math.sin(a)*.18);group.add(b)}}
 if(type==='n'){const neck=makeBox(.19,.48,.2,body,0,.56,0);neck.rotation.z=-.25;group.add(neck);const head=makeBox(.27,.28,.42,body,.04,.86,-.06);head.rotation.z=-.15;group.add(head);const ear=makeBox(.12,.22,.12,trim,.05,1.06,-.1);ear.rotation.z=-.25;group.add(ear)}
 if(type==='b'){cyl(.13,.19,.42,.56,body);const orb=new THREE.Mesh(new THREE.SphereGeometry(.2,18,14),trim);orb.position.y=.86;group.add(orb);const tip=new THREE.Mesh(new THREE.ConeGeometry(.1,.25,16),body);tip.position.y=1.08;group.add(tip)}
 if(type==='q'||type==='k'){cyl(.18,.22,.45,.56,body);const orb=new THREE.Mesh(new THREE.SphereGeometry(.19,18,14),body);orb.position.y=.88;group.add(orb);const crown=new THREE.Mesh(new THREE.ConeGeometry(.27,.32,8),trim);crown.position.y=1.12;group.add(crown);if(type==='k'){const cross=makeBox(.08,.35,.08,trim,0,1.35,0);group.add(cross);const crossbar=makeBox(.25,.07,.08,trim,0,1.4,0);group.add(crossbar)}}
 group.userData={type,color};return group;
}
function drawPieces(){for(const p of pieceMeshes){scene.remove(p);disposeObject(p)}pieceMeshes=[];const board=chess.board();board.forEach((row,r)=>row.forEach((p,f)=>{if(!p)return;const mesh=makeChessPiece(p.type,p.color);mesh.position.copy(boardPos(f,7-r));mesh.userData={...mesh.userData,file:f,rank:r};scene.add(mesh);pieceMeshes.push(mesh)}))}
function renderHistory(){const h=chess.history();$('moveHistory').innerHTML=h.length?h.map((m,i)=>i%2===0?'<span class="move-no">'+(Math.floor(i/2)+1)+'.</span><span>'+m+'</span>':'<span>'+m+'</span>').join(''):'<span class="muted">No moves yet.</span>'}
function updateTurn(){const side=chess.turn()==='w'?'WHITE':'BLACK';$('turnIndicator').textContent=side+' TO MOVE';$('statusTitle').textContent=chess.isCheckmate()?'CHECKMATE':chess.isCheck()?'CHECK!':'Your move.';$('statusText').textContent=chess.isDraw()?'The game is drawn.':chess.isCheck()?'Your king is under threat.':side+' chooses a piece and a legal destination.'}
function showUnit(type,color){const p=pieceInfo[type];$('unitIcon').textContent=p.icon;$('unitName').textContent=p.name;$('unitMeta').textContent=(color==='w'?'WHITE':'BLACK')+' · '+p.hp+' HP';$('unitDescription').textContent=p.description}
function selectSquare(file,rank){const square=String.fromCharCode(97+file)+(8-rank);if(!selected){const piece=chess.get(square);if(!piece||piece.color!==chess.turn())return;selected=square;legalTargets=chess.moves({square,verbose:true});showUnit(piece.type,piece.color);highlight();return}const move=legalTargets.find(m=>m.to===square);if(move){if(move.captured){pendingMove={from:selected,to:square,promotion:move.promotion,attacker:chess.get(selected),defender:chess.get(square)};startBattle(pendingMove);return}const result=chess.move({from:selected,to:square});if(result){selected=null;legalTargets=[];drawPieces();renderHistory();updateTurn();highlight()}}else{const piece=chess.get(square);if(piece&&piece.color===chess.turn()){selected=square;legalTargets=chess.moves({square,verbose:true});showUnit(piece.type,piece.color);highlight()}else{selected=null;legalTargets=[];highlight()}}}
function highlight(){for(const s of squares){const {file,rank}=s.userData;const name=String.fromCharCode(97+file)+(8-rank);const isSelected=name===selected;const isTarget=legalTargets.some(m=>m.to===name);s.material=isSelected?mats.accent:isTarget?new THREE.MeshStandardMaterial({color:0x8bcf63,transparent:true,opacity:.8}):(file+rank)%2?mats.dark:mats.light;s.scale.y=isSelected?1.12:1} }
function onBoardClick(e){if(mode!=='board')return;const rect=canvas.getBoundingClientRect();pointer.x=((e.clientX-rect.left)/rect.width)*2-1;pointer.y=-((e.clientY-rect.top)/rect.height)*2+1;raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObjects([...pieceMeshes,...squares],true);if(!hits.length)return;let o=hits[0].object;while(o&&o.userData.file===undefined&&o.userData.type!=='square')o=o.parent;if(o&&o.userData.file!==undefined)selectSquare(o.userData.file,o.userData.rank)}
function buildArena(){
 clearWorld();scene.background.set(0x172331);scene.fog=new THREE.Fog(0x172331,20,65);
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(90,90),new THREE.MeshStandardMaterial({color:0x34434a,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.1;ground.receiveShadow=true;scene.add(ground);
 const stone=new THREE.MeshStandardMaterial({color:0x53616b,roughness:.85}),darkStone=new THREE.MeshStandardMaterial({color:0x273441,roughness:.8});
 for(let i=0;i<18;i++){const a=i/18*Math.PI*2;const x=Math.cos(a)*13,z=Math.sin(a)*13;const h=2.4+(i%4)*.6;const pillar=makeBox(1.2,h,1.2,stone,x,h/2-.1,z);scene.add(pillar);const cap=makeBox(1.5,.25,1.5,mats.gold,x,h,z);scene.add(cap)}
 for(let i=0;i<10;i++){const x=(Math.random()-.5)*18,z=(Math.random()-.5)*18;if(Math.abs(x)<3&&Math.abs(z)<4)continue;const block=makeBox(1.4,1.5+(i%3)*.5,1.4,darkStone,x,.7,z);scene.add(block)}
 const ring=new THREE.Mesh(new THREE.TorusGeometry(8,.12,8,64),mats.gold);ring.rotation.x=Math.PI/2;ring.position.y=.04;scene.add(ring);
 const light=new THREE.PointLight(0x8db9e8,80,30);light.position.set(0,9,0);scene.add(light);
}
function fighter(type,color,isPlayer){const info=pieceInfo[type];const group=new THREE.Group();const armor=color==='w'?new THREE.MeshStandardMaterial({color:0xd8dfdf,metalness:.55,roughness:.3}):new THREE.MeshStandardMaterial({color:0x343e4b,metalness:.6,roughness:.3});const glow=color==='w'?mats.gold:mats.red;
 const torso=makeBox(.75,1,.42,armor,0,1.25,0);group.add(torso);const head=new THREE.Mesh(new THREE.SphereGeometry(.28,18,16),armor);head.position.y=1.95;head.castShadow=true;group.add(head);
 const shoulder1=makeBox(.32,.3,.42,glow,-.52,1.55,0),shoulder2=makeBox(.32,.3,.42,glow,.52,1.55,0);group.add(shoulder1,shoulder2);
 for(const x of [-.23,.23]){const leg=makeBox(.24,.75,.3,armor,x,.38,0);group.add(leg)}
 const weapon=makeBox(.12,.9,.12,glow,.52,1.15,-.2);weapon.rotation.z=-.25;group.add(weapon);
 group.position.set(isPlayer?-3:3,0,isPlayer?2:-2);scene.add(group);group.userData={type,color,hp:info.hp,maxHp:info.hp,speed:info.speed,damage:info.damage,isPlayer,decoys:[],shieldUntil:0,alive:true};return group;
}
function startBattle(move){mode='battle';activePiece=move.attacker.type;const aColor=move.attacker.color,dColor=move.defender.color;buildArena();player=fighter(move.attacker.type,aColor,true);opponent=fighter(move.defender.type,dColor,false);opponent.rotation.y=Math.PI;
 yaw=0;pitch=0;camera.position.set(player.position.x,1.65,player.position.z);camera.rotation.order='YXZ';camera.rotation.set(0,0,0);$('phasePill').textContent='FPS COMBAT';$('boardHint').classList.add('hidden');$('crosshair').classList.remove('hidden');$('battleHud').classList.remove('hidden');$('attackerName').textContent=pieceInfo[move.attacker.type].name;$('defenderName').textContent=pieceInfo[move.defender.type].name;$('attackerLabel').textContent=aColor==='w'?'WHITE ATTACKER':'BLACK ATTACKER';$('defenderLabel').textContent=dColor==='w'?'WHITE DEFENDER':'BLACK DEFENDER';updateHealth();$('battleTip').textContent='WASD move · Mouse aim · Click attack · E / R abilities · ESC unlock mouse';$('statusTitle').textContent='Capture duel';$('statusText').textContent='Defeat the opposing piece to decide the capture.';$('loadingOverlay').classList.add('hidden');toast(pieceInfo[move.attacker.type].name+' VS '+pieceInfo[move.defender.type].name+' — FIGHT!')}
function updateHealth(){$('attackerHealth').style.width=Math.max(0,player.userData.hp/player.userData.maxHp*100)+'%';$('defenderHealth').style.width=Math.max(0,opponent.userData.hp/opponent.userData.maxHp*100)+'%'}
function lockMouse(){if(mode==='battle'&&canvas.requestPointerLock)canvas.requestPointerLock()}
document.addEventListener('pointerlockchange',()=>{locked=document.pointerLockElement===canvas});
canvas.addEventListener('click',e=>{if(mode==='board')onBoardClick(e);else if(mode==='battle'&&!locked)lockMouse();else if(mode==='battle')attack()});
document.addEventListener('mousemove',e=>{if(!locked||mode!=='battle')return;yaw-=e.movementX*.0022;pitch-=e.movementY*.0022;pitch=Math.max(-1.25,Math.min(1.25,pitch));camera.rotation.set(pitch,yaw,0,'YXZ')});
document.addEventListener('keydown',e=>{keys[e.code]=true;if(e.code==='Escape'&&mode==='battle'&&document.pointerLockElement)document.exitPointerLock();if(mode==='battle'&&e.code==='KeyE')ability('E');if(mode==='battle'&&e.code==='KeyR')ability('R')});
document.addEventListener('keyup',e=>keys[e.code]=false);
function forwardVector(){return new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw))}
function attack(){if(!player||!opponent||!opponent.userData.alive)return;const now=performance.now();if(now-lastAttack<420)return;lastAttack=now;const dir=new THREE.Vector3(-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));const start=camera.position.clone();const target=opponent.position.clone().add(new THREE.Vector3(0,1.1,0));const to=target.clone().sub(start);if(to.length()<12&&dir.dot(to.normalize())>.72){damage(opponent,player.userData.damage);spawnBurst(target,0xffd27b)}else{const end=start.clone().add(dir.multiplyScalar(12));spawnTracer(start,end,0xe8e2c7)}}
function damage(target,amount){if(target.userData.shieldUntil>Date.now())amount*=.35;target.userData.hp=Math.max(0,target.userData.hp-amount);target.position.x+=(Math.random()-.5)*.18;updateHealth();if(target.userData.hp<=0){target.userData.alive=false;finishBattle(target===opponent?'attacker':'defender')}}
function spawnBurst(pos,color){const geo=new THREE.SphereGeometry(.18,8,8),mat=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.9});const m=new THREE.Mesh(geo,mat);m.position.copy(pos);scene.add(m);effects.push(m)}
function spawnTracer(a,b,color){const geo=new THREE.BufferGeometry().setFromPoints([a,b]);const line=new THREE.Line(geo,new THREE.LineBasicMaterial({color,transparent:true,opacity:.8}));scene.add(line);effects.push(line)}
function projectile(from,to,damageAmount,color,speed=18){const mesh=new THREE.Mesh(new THREE.SphereGeometry(.13,10,8),new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.6}));mesh.position.copy(from);scene.add(mesh);projectiles.push({mesh,from:from.clone(),to:to.clone(),damage:damageAmount,speed,life:0})}
function ability(key){const now=Date.now();if(now-(lastAbility[key]||0)<5000){toast('Ability recharging');return}lastAbility[key]=now;const t=player.userData.type,forward=forwardVector(),origin=camera.position.clone(),target=opponent.position.clone().add(new THREE.Vector3(0,1,0));
 if(t==='p'&&key==='E'){for(let i=0;i<2;i++){const d=fighter('p',player.userData.color,true);d.scale.setScalar(.55);d.position.copy(player.position).add(new THREE.Vector3(i?1:-1,0,-1));player.userData.decoys.push(d)}toast('PAWN CLONES SUMMONED')}
 else if(t==='p'&&key==='R'){projectile(origin,origin.clone().add(forward.multiplyScalar(14)),28,0xd9e6f2,24);toast('SWORD THROW')}
 else if(t==='n'&&key==='E'){for(let i=0;i<15;i++){const spread=new THREE.Vector3((Math.random()-.5)*.2,(Math.random()-.5)*.16,0);const dir=forward.clone().add(spread).normalize();projectile(origin,origin.clone().add(dir.multiplyScalar(16)),8,0xc7d9ef,26)}toast('ARROW VOLLEY')}
 else if(t==='n'&&key==='R'){const dir=forward.clone();player.position.add(dir.multiplyScalar(4));camera.position.add(dir.multiplyScalar(4));toast('GRAPPLE DASH')}
 else if(t==='b'&&key==='E'){const d=target.distanceTo(player.position);if(d<9)damage(opponent,32);spawnBurst(target,0x9c7cff);toast('ARCANE BURST')}
 else if(t==='b'&&key==='R'){player.position.add(forward.multiplyScalar(5));camera.position.add(forward.multiplyScalar(5));toast('BLINK')}
 else if(t==='r'&&key==='E'){player.userData.shieldUntil=Date.now()+3500;toast('BULWARK ACTIVE')}
 else if(t==='r'&&key==='R'){player.position.add(forward.multiplyScalar(3));camera.position.add(forward.multiplyScalar(3));if(target.distanceTo(player.position)<3)damage(opponent,38);toast('ROOK CHARGE')}
 else if(t==='q'&&key==='E'){if(target.distanceTo(player.position)<10)damage(opponent,34);spawnTracer(origin,target,0x9c6cff);toast('QUEEN ENERGY WAVE')}
 else if(t==='q'&&key==='R'){player.position.add(forward.multiplyScalar(4));camera.position.add(forward.multiplyScalar(4));toast('QUEEN DASH')}
 else if(t==='k'&&key==='E'){player.userData.shieldUntil=Date.now()+4000;player.userData.hp=Math.min(player.userData.maxHp,player.userData.hp+18);updateHealth();toast('ROYAL AURA')}
 else if(t==='k'&&key==='R'){if(target.distanceTo(player.position)<8)damage(opponent,42);spawnBurst(target,0xffd06a);toast('ROYAL STRIKE')}
}
function finishBattle(winner){mode='result';document.exitPointerLock?.();const attackerWon=winner==='attacker';$('resultTitle').textContent=attackerWon?'VICTORY':'DEFEAT';$('resultTitle').style.color=attackerWon?'#a6f36a':'#ff646b';$('resultText').textContent=attackerWon?'The attacking piece wins. The capture will be applied.':'The defending piece holds its square. The capture is cancelled.';$('resultOverlay').classList.remove('hidden');$('phasePill').textContent='BATTLE COMPLETE';$('crosshair').classList.add('hidden')}
function resolveBattle(){if(!pendingMove)return;const attackerWon=player.userData.hp>0; if(attackerWon){const result=chess.move({from:pendingMove.from,to:pendingMove.to,...(pendingMove.promotion?{promotion:pendingMove.promotion}:{})});if(result)toast(pieceInfo[result.piece].name+' captured '+pieceInfo[result.captured].name)}else{const fen=chess.fen().split(' ');fen[1]=pendingMove.attacker.color==='w'?'b':'w';chess.load(fen.join(' '));toast('Defender survived — capture cancelled')}pendingMove=null;selected=null;legalTargets=[];mode='board';$('resultOverlay').classList.add('hidden');$('battleHud').classList.add('hidden');$('crosshair').classList.add('hidden');$('boardHint').classList.remove('hidden');$('phasePill').textContent='CHESS PHASE';$('statusTitle').textContent='Battle resolved';$('statusText').textContent='The chess turn has advanced.';buildBoard();renderHistory();updateTurn();showUnit('p','w')}
$('continueButton').addEventListener('click',resolveBattle);
$('newGame').addEventListener('click',()=>{if(document.pointerLockElement)document.exitPointerLock();chess.reset();pendingMove=null;selected=null;legalTargets=[];mode='board';$('resultOverlay').classList.add('hidden');$('battleHud').classList.add('hidden');$('crosshair').classList.add('hidden');$('boardHint').classList.remove('hidden');$('phasePill').textContent='CHESS PHASE';buildBoard();renderHistory();updateTurn();toast('New match started')});
function updateBattle(dt){if(!player||!opponent||mode!=='battle')return;const speed=player.userData.speed*(keys.ShiftLeft?1.45:1);const f=forwardVector(),right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));const move=new THREE.Vector3();if(keys.KeyW)move.add(f);if(keys.KeyS)move.sub(f);if(keys.KeyD)move.add(right);if(keys.KeyA)move.sub(right);if(move.lengthSq())move.normalize().multiplyScalar(speed*dt);player.position.add(move);player.position.x=THREE.MathUtils.clamp(player.position.x,-18,18);player.position.z=THREE.MathUtils.clamp(player.position.z,-18,18);if(keys.Space&&player.position.y===0)velocity.y=6;velocity.y-=18*dt;player.position.y=Math.max(0,player.position.y+velocity.y*dt);if(player.position.y===0)velocity.y=0;camera.position.set(player.position.x,player.position.y+1.65,player.position.z);
 const toward=player.position.clone().sub(opponent.position);toward.y=0;if(toward.length()>1.7){toward.normalize();opponent.position.add(toward.multiplyScalar((opponent.userData.speed*.48)*dt))}opponent.lookAt(player.position.x,opponent.position.y+1,player.position.z);
 for(const decoy of player.userData.decoys){const offset=decoy.position.clone().sub(player.position);if(offset.length()>1.8)decoy.position.lerp(player.position.clone().add(new THREE.Vector3(offset.x>0?1:-1,0,1)),dt*2.5)}\n if(player.position.distanceTo(opponent.position)<2.2&&Math.random()<dt*.7)damage(player,opponent.userData.damage*.24);
 for(let i=projectiles.length-1;i>=0;i--){const p=projectiles[i];const delta=p.to.clone().sub(p.mesh.position);const step=Math.min(delta.length(),p.speed*dt);p.mesh.position.add(delta.normalize().multiplyScalar(step));p.life+=dt;if(p.mesh.position.distanceTo(opponent.position.clone().add(new THREE.Vector3(0,1,0)))<.8){damage(opponent,p.damage);scene.remove(p.mesh);projectiles.splice(i,1)}else if(p.life>1.2||step===0){scene.remove(p.mesh);projectiles.splice(i,1)}}
 for(let i=effects.length-1;i>=0;i--){const o=effects[i];o.userData.life=(o.userData.life||0)+dt;if(o.userData.life>.25){scene.remove(o);effects.splice(i,1)}}
}
function resize(){const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false)}
window.addEventListener('resize',resize);
function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.04);if(mode==='battle')updateBattle(dt);renderer.render(scene,camera)}
function start(){buildBoard();resize();renderHistory();updateTurn();$('loadingOverlay').classList.add('hidden');$('playButton')?.closest('#menu')?.classList.add('hidden')}
start();animate();
