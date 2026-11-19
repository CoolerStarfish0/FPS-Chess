import * as THREE from 'three';
import { Chess } from 'chess.js';

const $ = (id) => document.getElementById(id);
const chess = new Chess();
const boardHost = $('board3d');
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const boardScene = new THREE.Scene();
boardScene.background = new THREE.Color(0x111b2b);
const boardCamera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
boardCamera.position.set(8.8, 10.8, 11.8);
boardCamera.lookAt(0, 0, 0);
const boardRenderer = new THREE.WebGLRenderer({antialias:true});
boardRenderer.setPixelRatio(Math.min(devicePixelRatio, 2));
boardRenderer.shadowMap.enabled = true;
boardRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
boardHost.appendChild(boardRenderer.domElement);
boardScene.add(new THREE.HemisphereLight(0xc8ddff,0x273044,2.1));
const boardLight = new THREE.DirectionalLight(0xffe5bd,3.2);
boardLight.position.set(-5,10,7); boardLight.castShadow=true; boardScene.add(boardLight);
const boardRoot = new THREE.Group(); boardScene.add(boardRoot);
const squareMeshes = [];
let selected = null, legalTargets = [], flipped = false, busy = false;
const pieceMeshes = new Map();
const pieceNames = {p:'Pawn',n:'Knight',b:'Bishop',r:'Rook',q:'Queen',k:'King'};
const pieceColors = {w:0xe8edf5,b:0x26354c};
const mat = (color, metalness=.15, roughness=.5) => new THREE.MeshStandardMaterial({color,metalness,roughness});
const whiteMat=mat(0xe9edf4,.3,.28), blackMat=mat(0x26354c,.5,.32), goldMat=mat(0xc9a34d,.65,.3);
const highlightMat= new THREE.MeshBasicMaterial({color:0xa3e635,transparent:true,opacity:.55});
const captureMat= new THREE.MeshBasicMaterial({color:0xfb6574,transparent:true,opacity:.55});
function sqPos(square){const file=square.charCodeAt(0)-97, rank=Number(square[1])-1;return {x:(flipped?7-file:file)-3.5,z:(flipped?rank:7-rank)-3.5};}
function makePiece(type,color){
 const group=new THREE.Group(), m=color==='w'?whiteMat:blackMat;
 const base=new THREE.Mesh(new THREE.CylinderGeometry(.32,.39,.16,24),m);base.position.y=.12;base.castShadow=true;group.add(base);
 const stem=new THREE.Mesh(new THREE.CylinderGeometry(.19,.25,.42,20),m);stem.position.y=.4;stem.castShadow=true;group.add(stem);
 if(type==='p'){const head=new THREE.Mesh(new THREE.SphereGeometry(.2,18,14),m);head.position.y=.76;group.add(head);}
 if(type==='n'){const neck=new THREE.Mesh(new THREE.ConeGeometry(.23,.55,4),m);neck.position.set(0,.82,0);neck.rotation.z=-.35;group.add(neck);const head=new THREE.Mesh(new THREE.SphereGeometry(.16,16,12),m);head.position.set(.12,1.08,0);group.add(head);}
 if(type==='b'){const hat=new THREE.Mesh(new THREE.ConeGeometry(.24,.55,8),m);hat.position.y=.88;group.add(hat);const orb=new THREE.Mesh(new THREE.SphereGeometry(.11,16,12),goldMat);orb.position.y=1.18;group.add(orb);}
 if(type==='r'){const top=new THREE.Mesh(new THREE.CylinderGeometry(.28,.25,.24,8),m);top.position.y=.82;group.add(top);for(let i=0;i<4;i++){const tooth=new THREE.Mesh(new THREE.BoxGeometry(.11,.2,.13),m);tooth.position.set(Math.cos(i*Math.PI/2)*.19,.99,Math.sin(i*Math.PI/2)*.19);group.add(tooth);}}
 if(type==='q'){const crown=new THREE.Mesh(new THREE.CylinderGeometry(.12,.28,.18,12),goldMat);crown.position.y=.9;group.add(crown);for(let i=0;i<5;i++){const jewel=new THREE.Mesh(new THREE.SphereGeometry(.07,12,10),goldMat);const a=i*Math.PI*2/5;jewel.position.set(Math.cos(a)*.2,1.04,Math.sin(a)*.2);group.add(jewel);}}
 if(type==='k'){const cross=new THREE.Mesh(new THREE.BoxGeometry(.09,.4,.09),goldMat);cross.position.y=1.1;group.add(cross);const bar=new THREE.Mesh(new THREE.BoxGeometry(.3,.09,.09),goldMat);bar.position.y=1.12;group.add(bar);}
 group.userData={type,color};return group;
}
function buildBoard(){
 boardRoot.clear();squareMeshes.length=0;pieceMeshes.clear();
 const floor=new THREE.Mesh(new THREE.BoxGeometry(8.5,.3,8.5),mat(0x35445a,.3,.55));floor.position.y=-.22;floor.receiveShadow=true;boardRoot.add(floor);
 for(let r=0;r<8;r++)for(let f=0;f<8;f++){
  const square=String.fromCharCode(97+f)+(8-r), light=(r+f)%2===0;
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(1,.12,1),mat(light?0xc7d0d8:0x40536b,.12,.7));
  mesh.position.set(f-3.5,-.02,r-3.5);mesh.receiveShadow=true;mesh.userData={square};boardRoot.add(mesh);squareMeshes.push(mesh);
 }
 const rim=new THREE.Mesh(new THREE.BoxGeometry(8.7,.2,8.7),goldMat);rim.position.y=-.32;boardRoot.add(rim);
 const coords=chess.board();
 coords.forEach((row,r)=>row.forEach((piece,f)=>{if(!piece)return;const sq=String.fromCharCode(97+f)+(8-r);const mesh=makePiece(piece.type,piece.color);const p=sqPos(sq);mesh.position.set(p.x,.06,p.z);mesh.userData.square=sq;boardRoot.add(mesh);pieceMeshes.set(sq,mesh);}));
 updateHighlights();
}
function updateHighlights(){
 for(const mesh of squareMeshes){const s=mesh.userData.square;mesh.material=mat(((Number(s[1])+s.charCodeAt(0)-97)%2===0)?0xc7d0d8:0x40536b,.12,.7);if(legalTargets.includes(s))mesh.material=chess.get(s)?captureMat:highlightMat;}
}
function renderBoard(){const w=boardHost.clientWidth,h=boardHost.clientHeight;if(!w||!h)return;boardCamera.aspect=w/h;boardCamera.updateProjectionMatrix();boardRenderer.setSize(w,h,false);boardRenderer.render(boardScene,boardCamera);}
function refreshBoard(){buildBoard();renderBoard();updateStatus();}
function updateStatus(){
 const over=chess.isGameOver();$('turnName').textContent=chess.turn()==='w'?'White to move':'Black to move';
 $('statusTitle').textContent=over?(chess.isCheckmate()?'Checkmate': 'Game over'):chess.isCheck()?'Check!':chess.turn()==='w'?'Your move':'Opponent thinking…';
 $('statusText').textContent=over?(chess.isCheckmate()?(chess.turn()==='w'?'Black wins.':'White wins.'):'The game ended in a draw.'):chess.turn()==='w'?'Select one of your pieces, then choose a highlighted square.':'The opponent is choosing a move.';
 const hist=chess.history();$('moveHistory').innerHTML=hist.length?hist.map((m,i)=>i%2===0?'<li><b>'+(Math.floor(i/2)+1)+'.</b> '+m+'</li>':'<li>'+m+'</li>').join(''):'<li class="empty-history">The battle begins…</li>';
 $('phasePill').textContent='CHESS PHASE';
}
function onBoardClick(event){
 if(busy||chess.turn()!=='w'||$('chessScreen').classList.contains('hidden'))return;
 const rect=boardRenderer.domElement.getBoundingClientRect();pointer.x=((event.clientX-rect.left)/rect.width)*2-1;pointer.y=-((event.clientY-rect.top)/rect.height)*2+1;raycaster.setFromCamera(pointer,boardCamera);
 const hits=raycaster.intersectObjects(boardRoot.children,true);let square=null;
 for(const hit of hits){let obj=hit.object;while(obj&& !obj.userData.square)obj=obj.parent;if(obj?.userData.square){square=obj.userData.square;break;}}
 if(!square)return;
 if(selected&&legalTargets.includes(square)){const move=chess.moves({square:selected,verbose:true}).find(m=>m.to===square);if(move){if(move.captured){startDuel({from:move.from,to:move.to,piece:move.piece,captured:move.captured,promotion:move.promotion,color:'w'});}else{chess.move({from:move.from,to:move.to});selected=null;legalTargets=[];refreshBoard();setTimeout(aiMove,500);}return;}}
 const p=chess.get(square);if(p&&p.color==='w'){selected=square;legalTargets=chess.moves({square,verbose:true}).map(m=>m.to);updateHighlights();}else{selected=null;legalTargets=[];updateHighlights();}
}
boardRenderer.domElement.addEventListener('click',onBoardClick);
function aiMove(){
 if(chess.isGameOver()||busy||chess.turn()!=='b')return;
 const moves=chess.moves({verbose:true});if(!moves.length)return;
 const captures=moves.filter(m=>m.captured);
 let move;
 if(captures.length&&Math.random()<.72)move=captures[Math.floor(Math.random()*captures.length)];
 else move=moves[Math.floor(Math.random()*moves.length)];
 if(move.captured)startDuel({from:move.from,to:move.to,piece:move.piece,captured:move.captured,promotion:move.promotion,color:'b'});
 else{chess.move({from:move.from,to:move.to,promotion:'q'});refreshBoard();}
}
$('flipBoardBtn').onclick=()=>{flipped=!flipped;refreshBoard();};
$('newGameBtn').onclick=()=>{if(busy)return;chess.reset();selected=null;legalTargets=[];refreshBoard();};
window.addEventListener('resize',renderBoard);
buildBoard();renderBoard();updateStatus();
function makeArena(){
 const scene=new THREE.Scene();scene.background=new THREE.Color(0x91a8bd);scene.fog=new THREE.Fog(0x91a8bd,18,55);
 const camera=new THREE.PerspectiveCamera(75,1,.1,100);camera.position.set(0,1.7,7);
 const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.domElement.style.zIndex='0';$('combatView').appendChild(renderer.domElement);
 scene.add(new THREE.HemisphereLight(0xe4f2ff,0x4a3b30,2));
 const sun=new THREE.DirectionalLight(0xffe4c1,3);sun.position.set(-5,12,8);sun.castShadow=true;scene.add(sun);
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(70,70),mat(0x536b58));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
 const wallMat=mat(0x596777), coverMat=mat(0x68798a);
 for(let i=0;i<4;i++){const wall=new THREE.Mesh(new THREE.BoxGeometry(22,3,.5),wallMat);wall.position.set(0,1.5,i%2===0?-11:11);scene.add(wall);const side=new THREE.Mesh(new THREE.BoxGeometry(.5,3,22),wallMat);side.position.set(i<2?-11:11,1.5,0);scene.add(side);}
 for(let i=0;i<9;i++){const box=new THREE.Mesh(new THREE.BoxGeometry(1.5,1.2,1.5),coverMat);box.position.set((i%3-1)*5,.6,Math.floor(i/3)*-4-1);box.castShadow=true;box.receiveShadow=true;scene.add(box);}
 const makeFighter=(color)=>{const g=new THREE.Group();const body=new THREE.Mesh(new THREE.CapsuleGeometry(.38,.75,5,10),mat(color,.2,.4));body.position.y=1.1;body.castShadow=true;g.add(body);const head=new THREE.Mesh(new THREE.SphereGeometry(.25,16,12),mat(0xd9c4a7));head.position.y=1.75;g.add(head);const ring=new THREE.Mesh(new THREE.TorusGeometry(.42,.045,8,24),mat(color));ring.rotation.x=Math.PI/2;ring.position.y=.12;g.add(ring);scene.add(g);return g;};
 return {scene,camera,renderer,player:makeFighter(0xa3e635),enemy:makeFighter(0xfb6574)};
}
let arena=null, duel=null, keys={},lastTime=0,animId=0,paused=false,verticalVelocity=0;
const abilityInfo={p:['Sword throw','Clone squad'],n:['Rapid arrow volley','Grapple'],b:['Arcane burst','Blink'],r:['Cannon shot','Fortify'],q:['Energy wave','Dash'],k:['Royal strike','Royal aura']};
function startDuel(move){
 busy=true;selected=null;legalTargets=[];$('chessScreen').classList.add('hidden');$('combatScreen').classList.remove('hidden');$('phasePill').textContent='FPS DUEL';$('duelTitle').textContent=pieceNames[move.piece]+' vs '+pieceNames[move.captured];
 const playerType=move.color==='w'?move.piece:move.captured, enemyType=move.color==='w'?move.captured:move.piece;
 $('playerPieceName').textContent=pieceNames[playerType].toUpperCase();$('enemyPieceName').textContent=pieceNames[enemyType].toUpperCase();
 $('abilityText').textContent='LMB '+(abilityInfo[playerType][0])+' · E '+abilityInfo[playerType][1]+' · R Special';
 arena=makeArena();const player=arena.player,enemy=arena.enemy;player.position.set(0,0,5);enemy.position.set(0,0,-5);verticalVelocity=0;arena.camera.position.set(0,1.7,5);
 duel={move,playerType,enemyType,player,enemy,playerHp:100,enemyHp:100,ended:false,elapsed:0,attackCooldown:0,abilityCooldown:0,specialCooldown:0,clones:[],projectiles:[],grapple:null};
 updateHealth();$('combatMessage').classList.add('hidden');$('returnChessBtn').classList.add('hidden');paused=false;$('combatView').classList.remove('paused');
 arena.renderer.domElement.addEventListener('click',lockPointer);document.addEventListener('pointerlockchange',pointerLockChanged);
 window.addEventListener('keydown',keyDown);window.addEventListener('keyup',keyUp);arena.renderer.domElement.addEventListener('mousedown',firePrimary);
 lastTime=performance.now();animateArena();
}
function lockPointer(){if(!duel?.ended)arena.renderer.domElement.requestPointerLock?.();}
function pointerLockChanged(){if(!duel||duel.ended)return;paused=document.pointerLockElement!==arena?.renderer.domElement;$('combatView').classList.toggle('paused',paused);}
function keyDown(e){keys[e.code]=true;if(e.code==='Escape'&&duel&&!duel.ended&&document.pointerLockElement===arena?.renderer.domElement)document.exitPointerLock?.();if(e.code==='KeyE')useAbility();if(e.code==='KeyR')useSpecial();if(e.code==='Space')e.preventDefault();}
function keyUp(e){keys[e.code]=false;}
function firePrimary(e){if(!duel||duel.ended||paused||e.button!==0)return;attack();}
function attack(){
 if(duel.attackCooldown>0)return;duel.attackCooldown=.42;
 const type=duel.playerType;const dir=new THREE.Vector3();arena.camera.getWorldDirection(dir);
 const ranged=['n','b','r'].includes(type);
 const projectile=new THREE.Mesh(new THREE.SphereGeometry(type==='r'?.2:.12,10,8),mat(type==='b'?0x7c9cff:type==='r'?0xffa64d:0xe7eaf0, .3,.25));
 projectile.position.copy(arena.camera.position).add(dir.clone().multiplyScalar(.8));arena.scene.add(projectile);
 duel.projectiles.push({mesh:projectile,velocity:dir.multiplyScalar(type==='r'?24:30),owner:'player',damage:type==='r'?19:type==='b'?13:15,life:2});
 if(!ranged){projectile.position.set(duel.player.position.x,1.2,duel.player.position.z-0.8);projectile.userData.melee=true;}
}
function useAbility(){
 if(!duel||duel.ended||paused||duel.abilityCooldown>0)return;duel.abilityCooldown=5;const d=duel,t=d.playerType;
 if(t==='p'){for(let i=0;i<2;i++){const c=new THREE.Mesh(new THREE.CapsuleGeometry(.32,.65,4,8),mat(0xc3ed77,.1,.5));c.position.set(d.player.position.x+(i?1:-1),1,d.player.position.z+1);arena.scene.add(c);d.clones.push({mesh:c,life:5});}}
 if(t==='n'){for(let i=0;i<15;i++){const dir=new THREE.Vector3((Math.random()-.5)*.2,(Math.random()-.5)*.12,-1).normalize();addProjectile(dir,8,'player',0xe8edf5,34);}}
 if(t==='b'){const blast=new THREE.Mesh(new THREE.SphereGeometry(2,16,12),new THREE.MeshBasicMaterial({color:0x769bff,transparent:true,opacity:.35}));blast.position.copy(d.enemy.position).add(new THREE.Vector3(0,1,0));arena.scene.add(blast);if(d.enemy.position.distanceTo(d.player.position)<8)damageEnemy(24);setTimeout(()=>arena?.scene.remove(blast),350);}
 if(t==='r'){d.shield=4;const shield=new THREE.Mesh(new THREE.SphereGeometry(1.2,16,12),new THREE.MeshBasicMaterial({color:0x9cc9ff,wireframe:true,transparent:true,opacity:.45}));d.player.add(shield);setTimeout(()=>d.player.remove(shield),4000);}
 if(t==='q'){const wave=new THREE.Mesh(new THREE.TorusGeometry(2,.2,8,32),new THREE.MeshBasicMaterial({color:0x9be8ff,transparent:true,opacity:.8}));wave.rotation.x=Math.PI/2;wave.position.set(d.player.position.x,.3,d.player.position.z-2);arena.scene.add(wave);damageEnemy(20);setTimeout(()=>arena?.scene.remove(wave),500);}
 if(t==='k'){d.aura=4;const aura=new THREE.Mesh(new THREE.SphereGeometry(1.4,16,12),new THREE.MeshBasicMaterial({color:0xe8c96d,wireframe:true,transparent:true,opacity:.4}));d.player.add(aura);setTimeout(()=>d.player.remove(aura),4000);}
}
function useSpecial(){
 if(!duel||duel.ended||paused||duel.specialCooldown>0)return;duel.specialCooldown=4;const d=duel,t=d.playerType;
 if(t==='p'){addProjectile(new THREE.Vector3(0,0,-1),24,'player',0xe9edf5,28);}
 if(t==='n'){const dir=new THREE.Vector3();arena.camera.getWorldDirection(dir);const ray=new THREE.Raycaster(arena.camera.position,dir,0,26);const targets=arena.scene.children.filter(o=>o.isMesh&&o.geometry?.type==='BoxGeometry');const hit=ray.intersectObjects(targets,false)[0];if(hit)d.player.position.copy(hit.point.clone().addScaledVector(dir,-1.5));else d.player.position.add(dir.multiplyScalar(6));d.player.position.y=0;verticalVelocity=0;}
 if(t==='b'){const dir=new THREE.Vector3();arena.camera.getWorldDirection(dir);d.player.position.add(dir.multiplyScalar(7));d.player.position.y=0;}
 if(t==='r'){const dir=new THREE.Vector3();arena.camera.getWorldDirection(dir);d.player.position.add(dir.multiplyScalar(4));d.player.position.y=0;}
 if(t==='q'){const dir=new THREE.Vector3();arena.camera.getWorldDirection(dir);d.player.position.add(dir.multiplyScalar(8));d.player.position.y=0;}
 if(t==='k'){const dir=new THREE.Vector3();arena.camera.getWorldDirection(dir);addProjectile(dir,22,'player',0xffd56c,35);d.aura=3;}
}
function addProjectile(dir,speed,owner,color,damage){const mesh=new THREE.Mesh(new THREE.SphereGeometry(.1,10,8),mat(color));mesh.position.copy(owner==='player'?arena.camera.position:duel.enemy.position.clone().add(new THREE.Vector3(0,1,0)));arena.scene.add(mesh);duel.projectiles.push({mesh,velocity:dir.clone().normalize().multiplyScalar(speed),owner,damage,life:2});}
function damageEnemy(amount){if(duel.ended)return;duel.enemyHp=Math.max(0,duel.enemyHp-amount);updateHealth();if(!duel.enemyHp)endDuel(true);}
function damagePlayer(amount){if(duel.ended)return;if(duel.shield>0)amount*=.35;if(duel.aura>0)amount*=.5;duel.playerHp=Math.max(0,duel.playerHp-amount);updateHealth();if(!duel.playerHp)endDuel(false);}
function updateHealth(){$('playerHealth').style.width=duel.playerHp+'%';$('enemyHealth').style.width=duel.enemyHp+'%';}
function endDuel(playerWon){
 if(duel.ended)return;duel.ended=true;document.exitPointerLock?.();const m=duel.move;
 const captureSucceeded=(playerWon&&m.color==='w')||(!playerWon&&m.color==='b');
 if(captureSucceeded){chess.move({from:m.from,to:m.to,...(m.promotion?{promotion:m.promotion}:{})});$('combatMessage').textContent='CAPTURE CONFIRMED — ATTACKER WINS';}
 else{const fen=chess.fen().split(' ');fen[1]=m.color==='w'?'b':'w';chess.load(fen.join(' '));$('combatMessage').textContent='CAPTURE BLOCKED — DEFENDER HOLDS';}
 $('combatMessage').classList.remove('hidden');$('returnChessBtn').classList.remove('hidden');$('returnChessBtn').onclick=()=>finishDuel();
}
function finishDuel(){
 cancelAnimationFrame(animId);if(arena){arena.renderer.dispose();arena.renderer.domElement.remove();arena=null;}
 document.removeEventListener('pointerlockchange',pointerLockChanged);window.removeEventListener('keydown',keyDown);window.removeEventListener('keyup',keyUp);
 $('combatScreen').classList.add('hidden');$('chessScreen').classList.remove('hidden');$('phasePill').textContent='CHESS PHASE';busy=false;duel=null;keys={};refreshBoard();
 if(chess.turn()==='b'&&!chess.isGameOver())setTimeout(aiMove,500);
}
function animateArena(now=performance.now()){
 animId=requestAnimationFrame(animateArena);if(!arena||!duel)return;const dt=Math.min((now-lastTime)/1000,.04);lastTime=now;if(!paused&&!duel.ended)updateArena(dt);
 const w=$('combatView').clientWidth,h=$('combatView').clientHeight;arena.camera.aspect=w/h;arena.camera.updateProjectionMatrix();arena.renderer.setSize(w,h,false);arena.renderer.render(arena.scene,arena.camera);
}
function updateArena(dt){
 const d=duel;d.elapsed+=dt;const remaining=Math.max(0,75-Math.floor(d.elapsed));$('duelTimer').textContent='TIME '+String(Math.floor(remaining/60)).padStart(2,'0')+':'+String(remaining%60).padStart(2,'0');d.attackCooldown=Math.max(0,d.attackCooldown-dt);d.abilityCooldown=Math.max(0,d.abilityCooldown-dt);d.specialCooldown=Math.max(0,d.specialCooldown-dt);d.shield=Math.max(0,(d.shield||0)-dt);d.aura=Math.max(0,(d.aura||0)-dt);
 const forward=new THREE.Vector3();arena.camera.getWorldDirection(forward);forward.y=0;forward.normalize();const right=new THREE.Vector3().crossVectors(forward,new THREE.Vector3(0,1,0)).normalize();
 if(keys.Space&&d.player.position.y<=0.001)verticalVelocity=7;verticalVelocity-=18*dt;d.player.position.y=Math.max(0,d.player.position.y+verticalVelocity*dt);if(d.player.position.y===0)verticalVelocity=0;
 let move=new THREE.Vector3();if(keys.KeyW)move.add(forward);if(keys.KeyS)move.sub(forward);if(keys.KeyD)move.add(right);if(keys.KeyA)move.sub(right);if(move.lengthSq())move.normalize().multiplyScalar((keys.ShiftLeft?9:6)*dt);d.player.position.add(move);d.player.position.x=THREE.MathUtils.clamp(d.player.position.x,-9.5,9.5);d.player.position.z=THREE.MathUtils.clamp(d.player.position.z,-9.5,9.5);arena.camera.position.set(d.player.position.x,1.7+d.player.position.y,d.player.position.z);d.player.rotation.y=Math.atan2(-forward.x,-forward.z);
 const toPlayer=d.player.position.clone().sub(d.enemy.position);toPlayer.y=0;const dist=toPlayer.length();if(dist>2.1)d.enemy.position.add(toPlayer.normalize().multiplyScalar(2.8*dt));else if(Math.random()<dt*1.8){if(d.enemyType==='n'||d.enemyType==='b'||d.enemyType==='r')addProjectile(d.player.position.clone().add(new THREE.Vector3(0,1,0)).sub(d.enemy.position.clone().add(new THREE.Vector3(0,1,0))),16,'enemy',0xff6b78,8);else damagePlayer(7);}
 d.enemy.rotation.y=Math.atan2(d.player.position.x-d.enemy.position.x,d.player.position.z-d.enemy.position.z);
 for(let i=d.projectiles.length-1;i>=0;i--){const p=d.projectiles[i];p.mesh.position.add(p.velocity.clone().multiplyScalar(dt));p.life-=dt;const target=p.owner==='player'?d.enemy.position:d.player.position;if(p.mesh.position.distanceTo(target.clone().add(new THREE.Vector3(0,1,0)))<.8){if(p.owner==='player')damageEnemy(p.damage);else damagePlayer(p.damage);arena.scene.remove(p.mesh);d.projectiles.splice(i,1);}else if(p.life<=0){arena.scene.remove(p.mesh);d.projectiles.splice(i,1);}}
 for(let i=d.clones.length-1;i>=0;i--){const c=d.clones[i];c.life-=dt;c.mesh.position.lerp(d.player.position.clone().add(new THREE.Vector3(i?1:-1,0,1)),dt*3);if(c.mesh.position.distanceTo(d.enemy.position)<1.2){damageEnemy(5);c.life=0;}if(c.life<=0){arena.scene.remove(c.mesh);d.clones.splice(i,1);}}
 if(d.elapsed>75)endDuel(d.playerHp>=d.enemyHp);
}
document.addEventListener('mousemove',e=>{if(!duel||duel.ended||paused||document.pointerLockElement!==arena?.renderer.domElement)return;arena.camera.rotation.order='YXZ';arena.camera.rotation.y-=e.movementX*.0022;arena.camera.rotation.x-=e.movementY*.0022;arena.camera.rotation.x=THREE.MathUtils.clamp(arena.camera.rotation.x,-1.25,1.25);});
