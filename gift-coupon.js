export function saveGiftCoupon(){
  const canvas=document.createElement('canvas');canvas.width=1400;canvas.height=720;
  const c=canvas.getContext('2d');c.fillStyle='#f5eee1';c.fillRect(0,0,1400,720);
  c.strokeStyle='#c4a678';c.lineWidth=2;c.strokeRect(36,36,1328,648);c.strokeRect(47,47,1306,626);
  c.strokeStyle='#cab89a';c.setLineDash([7,10]);c.beginPath();c.moveTo(1090,70);c.lineTo(1090,650);c.stroke();c.setLineDash([]);
  c.fillStyle='#826b4d';c.font='30px Georgia';c.fillText('LCF',110,128);
  c.fillStyle='#463a2c';c.font='80px "Noto Serif SC","Songti SC","SimSun",serif';c.fillText('领取券',105,300);
  c.font='32px "Microsoft YaHei",sans-serif';c.fillStyle='#7e6b52';c.fillText('铃铛白模手办',110,370);
  c.fillStyle='#c8b697';c.fillRect(110,430,850,1);
  c.fillStyle='#463a2c';c.font='40px "Microsoft YaHei",sans-serif';c.fillText('回家即可兑换',110,540);
  c.textAlign='center';c.fillStyle='#a3875e';c.font='70px Georgia';c.fillText('18',1225,300);c.font='25px "Microsoft YaHei",sans-serif';c.fillText('生日礼物',1225,362);
  c.save();c.translate(918,160);c.rotate(-.13);c.strokeStyle='#9e6452';c.fillStyle='#9e6452';c.lineWidth=3;c.strokeRect(-97,-37,194,74);c.font='32px "Microsoft YaHei",sans-serif';c.fillText('已领取',0,11);c.restore();
  canvas.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='LCF-生日礼物领取券.png';link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);},'image/png');
}
