# contact sheet of atlases: python3 sheet.py out.jpg atlas1 atlas2 ... (shows each frame with its name)
import sys, json
from PIL import Image, ImageDraw
s=open('/Users/jasonchua/arcade-protos/arcade/img/art.js').read(); F=json.loads(s[s.index('{'):s.rindex('}')+1])['frames']
names=[n for n,v in F.items() if v[0] in sys.argv[2:]]
cw,ch=200,230; cols=8; rows=(len(names)+cols-1)//cols
c=Image.new('RGB',(cw*cols,ch*rows),(70,60,90)); d=ImageDraw.Draw(c); A={}
for i,n in enumerate(names):
    a,x,y,w,h=F[n][:5]; A.setdefault(a,Image.open(f'/Users/jasonchua/arcade-protos/arcade/img/atlas-{a}.webp').convert('RGBA'))
    im=A[a].crop((x,y,x+w,y+h)); im.thumbnail((cw-10,ch-25))
    X=(i%cols)*cw; Y=(i//cols)*ch; bg=c.crop((X+5,Y+5,X+5+im.width,Y+5+im.height)).convert('RGBA'); bg.alpha_composite(im); c.paste(bg,(X+5,Y+5))
    d.text((X+5,Y+ch-18),n,fill=(255,255,0))
c.save(sys.argv[1],quality=80)
