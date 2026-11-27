const edge=49;
const cell=.5;
const side=edge*2/cell;
const clearance=.24;
const index=(x,z)=>z*side+x;
const world=index=>({x:(index%side+.5)*cell-edge,z:(Math.floor(index/side)+.5)*cell-edge});

export function makeNavigation(obstacles) {
  const blocked=new Uint8Array(side*side);
  const grid=value=>Math.floor((value+edge)/cell);
  for(const [left,right,back,front] of obstacles) {
    const minX=Math.max(0,grid(left-clearance)), maxX=Math.min(side-1,grid(right+clearance));
    const minZ=Math.max(0,grid(back-clearance)), maxZ=Math.min(side-1,grid(front+clearance));
    for(let z=minZ;z<=maxZ;z++) blocked.fill(1,index(minX,z),index(maxX,z)+1);
  }
  const clear=(x,z)=>Math.max(Math.abs(x),Math.abs(z))<edge-.16 &&
    !obstacles.some(([left,right,back,front])=>x>left-clearance&&x<right+clearance&&z>back-clearance&&z<front+clearance);
  function line(a,b) {
    const steps=Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.17);
    for(let i=1;i<=steps;i++) {
      const unit=i/steps;
      if(!clear(a.x+(b.x-a.x)*unit,a.z+(b.z-a.z)*unit)) return false;
    }
    return true;
  }
  function walk(x,z,dx,dz) {
    if(clear(x+dx,z)) x+=dx;
    if(clear(x,z+dz)) z+=dz;
    return [x,z];
  }
  function route(from,to) {
    const x=grid(from.x),z=grid(from.z);
    if(x<0||x>=side||z<0||z>=side) return [];
    const start=index(x,z);
    const trace=new Int32Array(side*side).fill(-1);
    const queue=new Uint32Array(trace.length);
    queue[0]=start;
    trace[start]=start;
    let used=1;
    for(let head=0;head<used;head++) {
      const selected=queue[head];
      const current=world(selected);
      if(Math.hypot(current.x-to.x,current.z-to.z)<1.20) {
        const path=[];
        let at=selected;
        while(at!==start) {path.push(world(at));at=trace[at];}
        path.reverse();
        const turns=[];
        let last=from;
        for(let i=0;i<path.length;i++) {
          let best=i;
          while(best+1<path.length && line(last,path[best+1])) best++;
          last=path[best];
          turns.push(last);
          i=best;
        }
        return turns;
      }
      const ix=selected%side, iz=Math.floor(selected/side);
      for(const [nx,nz] of [[ix-1,iz],[ix+1,iz],[ix,iz-1],[ix,iz+1]]) {
        if(nx<0||nx>=side||nz<0||nz>=side) continue;
        const next=index(nx,nz);
        if(blocked[next]||trace[next]!==-1) continue;
        trace[next]=selected;
        queue[used++]=next;
      }
    }
    return [];
  }
  return {walk,line,route};
}
