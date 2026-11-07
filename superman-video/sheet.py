import sys
from PIL import Image
fs=sys.argv[2:]; out=sys.argv[1]
ims=[Image.open(f).resize((360,640)) for f in fs]
n=len(ims); cols=min(n,4); rows=(n+cols-1)//cols
S=Image.new('RGB',(360*cols,640*rows))
for i,im in enumerate(ims): S.paste(im,((i%cols)*360,(i//cols)*640))
S.save(out)
