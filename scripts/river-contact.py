#!/usr/bin/env python3
"""Build paired desktop and portrait review sheets from river screenshots."""
import argparse
from pathlib import Path
from PIL import Image, ImageDraw

AREAS = ('Reed Flats','Red Sluices','Whitewater Steps','Rain Cisterns','Blue Locks','Crown Spillway')


def thumbnail(source, w, h):
    image = Image.open(source).convert('RGB')
    image.thumbnail((w,h), Image.Resampling.LANCZOS)
    return image


def main():
    p = argparse.ArgumentParser()
    p.add_argument('shots', type=Path)
    p.add_argument('orchard', type=Path)
    args = p.parse_args()
    desktop, phone = (args.shots / size for size in ('1280x800','390x844'))
    names = sorted(f.name for f in desktop.glob('*.png') if f.name[:2].isdigit() and (phone/f.name).exists())
    levels = [n for n in names if int(n[:2]) >= 10]
    menus = [n for n in names if int(n[:2]) < 10]
    pages = [(name, levels[i*7:(i+1)*7]) for i,name in enumerate(AREAS)]
    pages.append(('Menus and progression',menus))
    for i,(name,items) in enumerate(pages):
        if not items:
            continue
        image=Image.new('RGB',(1230,410+296*((len(items)+1)//2)),'#10292b')
        d=ImageDraw.Draw(image)
        d.text((18,12),f'The River Remembers | {name}',fill='#ffe6b5',font_size=30)
        d.text((18,57),'Night Orchard reference',fill='#d7d2bd',font_size=18)
        image.paste(thumbnail(args.orchard,560,290),(18,84))
        d.text((610,89),'Production capture',fill='#ffe6b5',font_size=22)
        d.text((610,130),'Desktop 1280 x 800   Portrait 390 x 844',fill='#d7d2bd',font_size=17)
        for k,label in enumerate(items):
            x=18+610*(k%2)
            y=398+296*(k//2)
            d.text((x,y),label[3:-4].replace('-',' ').title(),fill='#ffe6b5',font_size=19)
            image.paste(thumbnail(desktop/label,469,242),(x,y+31))
            image.paste(thumbnail(phone/label,126,242),(x+438,y+31))
        image.save(args.shots/f'contact-{i+1}.png',optimize=True)


if __name__ == '__main__':
    main()
