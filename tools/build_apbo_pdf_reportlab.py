from pathlib import Path
from io import BytesIO
from html import escape
import re
import urllib.request
from docx import Document
from docx.text.paragraph import Paragraph as DocxParagraph
from docx.table import Table as DocxTable
from docx.oxml.ns import qn
from reportlab.platypus import SimpleDocTemplate, Paragraph, Table, TableStyle, Image, Spacer, PageBreak, KeepTogether
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle

BASE=Path(__file__).resolve().parents[1]
SOURCE=BASE/'Proposal_APBO_Wisata_Desa_Cupang_Kana_Nurhana_Naskah_Bersih.docx'
TARGET=BASE/'Proposal_APBO_Wisata_Desa_Cupang_Kana_Nurhana_Lengkap.pdf'
W,H=A4
styles={}
styles['body']=ParagraphStyle('body',fontName='Times-Roman',fontSize=11,leading=16.5,alignment=TA_JUSTIFY,spaceAfter=8,firstLineIndent=18)
styles['left']=ParagraphStyle('left',parent=styles['body'],alignment=TA_LEFT,firstLineIndent=0)
styles['small']=ParagraphStyle('small',fontName='Times-Roman',fontSize=9.5,leading=12.5,alignment=TA_LEFT,spaceAfter=4)
styles['th']=ParagraphStyle('th',parent=styles['small'],fontName='Times-Bold',fontSize=9.5)
styles['h1']=ParagraphStyle('h1',fontName='Times-Bold',fontSize=13,leading=17,alignment=TA_CENTER,spaceBefore=15,spaceAfter=10,keepWithNext=True)
styles['h2']=ParagraphStyle('h2',fontName='Times-Bold',fontSize=12,leading=16,alignment=TA_LEFT,spaceBefore=11,spaceAfter=6,keepWithNext=True)
styles['h3']=ParagraphStyle('h3',fontName='Times-Bold',fontSize=11.5,leading=15.5,alignment=TA_LEFT,spaceBefore=9,spaceAfter=5,keepWithNext=True)
styles['cover']=ParagraphStyle('cover',fontName='Times-Bold',fontSize=15,leading=19,alignment=TA_CENTER,spaceAfter=10)
styles['coverSmall']=ParagraphStyle('coverSmall',parent=styles['cover'],fontSize=11.5,leading=16)
styles['toc']=ParagraphStyle('toc',fontName='Times-Roman',fontSize=11,leading=16,spaceAfter=3)
doc=Document(str(SOURCE))
def iter_blocks(d):
    for child in d.element.body.iterchildren():
        if child.tag==qn('w:p'):
            yield DocxParagraph(child,d)
        elif child.tag==qn('w:tbl'):
            yield DocxTable(child,d)

def normalize(t):
    return (t.replace('–','-').replace('—','-').replace('→','->').replace('⇄','<->')
            .replace('×','x').replace('≤','&lt;=').replace('≥','&gt;=').replace('Σ','sum')
            .replace('“','"').replace('”','"').replace('‘',"'").replace('’',"'")
            .replace('•','-').replace('…','...').replace('−','-'))
def html(s):
    s=escape(normalize(s))
    s=s.replace('&amp;lt;','&lt;').replace('&amp;gt;','&gt;')
    s=re.sub(r'(https://(?:doi\.org|github\.com)/[^\s<]+)',lambda m:'<link href="'+m.group(1)+'" color="#1e4f87">'+m.group(1)+'</link>',s)
    return s

# Optional: Download official UMC university logo, matching the supplied emblem.
logo=None
try:
    req=urllib.request.Request('https://disposisi.umc.ac.id/assets/images/umc.png',headers={'User-Agent':'Mozilla/5.0'})
    with urllib.request.urlopen(req,timeout=25) as res: logo=res.read()
    if not logo.startswith(b'\x89PNG\r\n\x1a\n'): logo=None
except Exception as err:
    print('Logo unavailable:',err)
story=[]
is_cover=True
first_main=False
page_section=''

def table_block(tbl):
    rows=[]
    for i,row in enumerate(tbl.rows):
        cells=[]
        for cell in row.cells:
            text=' '.join(p.text.strip() for p in cell.paragraphs if p.text.strip())
            cells.append(Paragraph(html(text),styles['th' if i==0 else 'small']))
        rows.append(cells)
    if not rows:return
    n=len(rows[0]); maxWidth=W-100-72
    if n==2: widths=[maxWidth*.28,maxWidth*.72]
    elif n==3: widths=[maxWidth*.24,maxWidth*.37,maxWidth*.39]
    elif n==4: widths=[maxWidth*.18,maxWidth*.27,maxWidth*.27,maxWidth*.28]
    else: widths=[maxWidth/n]*n
    tab=Table(rows,colWidths=widths,repeatRows=1,hAlign='LEFT')
    tab.setStyle(TableStyle([
       ('GRID',(0,0),(-1,-1),0.35,colors.HexColor('#b6bbc1')),
       ('BACKGROUND',(0,0),(-1,0),colors.HexColor('#e9edf0')),
       ('VALIGN',(0,0),(-1,-1),'TOP'),
       ('LEFTPADDING',(0,0),(-1,-1),5),
       ('RIGHTPADDING',(0,0),(-1,-1),5),
       ('TOPPADDING',(0,0),(-1,-1),5),
       ('BOTTOMPADDING',(0,0),(-1,-1),5),
    ]))
    story.append(tab);story.append(Spacer(1,9))

for block in iter_blocks(doc):
    if isinstance(block,DocxTable):
        if is_cover:
            is_cover=False
        table_block(block)
        continue
    t=block.text.strip()
    if not t:
        if is_cover: story.append(Spacer(1,7))
        else: story.append(Spacer(1,3))
        continue
    if 'Daftar isi disusun sesuai urutan bab' in t:continue
    if 'pedoman teknis resmi proposal APBO' in t:continue
    if t=='KATA PENGANTAR':
        story.append(PageBreak());is_cover=False
    if t in ('BAB I','BAB II','BAB III'):
        story.append(PageBreak())
    if t.startswith('[TEMPAT LOGO RESMI'):
        if logo:
            try:
                img=Image(BytesIO(logo),width=112,height=112)
                img.hAlign='CENTER'
                story.append(Spacer(1,16));story.append(img);story.append(Spacer(1,15))
            except Exception as err:print('Logo render issue:',err)
        else:
            story.append(Spacer(1,100))
        continue
    if is_cover:
        sty=styles['cover'] if len(t)>25 else styles['coverSmall']
        story.append(Paragraph(html(t),sty))
    else:
        pstyle=block.style.name.lower()
        if t in ('BAB I','BAB II','BAB III') or t.isupper() and len(t)<80 and not t.startswith('LAMPIRAN'):
            style=styles['h1']
        elif re.match(r'^\d+\.\d+\.\d+\s',t):
            style=styles['h3']
        elif re.match(r'^\d+\.\d+\s',t) or t.startswith('LAMPIRAN'):
            style=styles['h2']
        elif pstyle.startswith('heading'):
            style=styles['h2']
        elif t.startswith('http') or t.startswith('yaergraze-ai.'):
            style=styles['left']
        elif t.startswith('Kata kunci:'):
            style=styles['left']
        elif re.match(r'^\d+[.]\s',t):
            style=styles['left']
        else:
            style=styles['body']
        story.append(Paragraph(html(t),style))
# Cover and title page have no page number; later pages are numbered.
def footer(canv,d):
    if d.page>1:
        canv.setFont('Times-Roman',9)
        canv.drawCentredString(W/2,38,str(d.page-1))

pdf=SimpleDocTemplate(str(TARGET),pagesize=A4,
                      leftMargin=95,rightMargin=68,topMargin=86,bottomMargin=72,
                      title='Proposal APBO - Wisata Desa Cupang',
                      author='Kana Nurhana',subject='Rancangan sistem informasi wisata dan e-ticketing')
pdf.build(story,onFirstPage=lambda c,d:None,onLaterPages=footer)
assert TARGET.exists() and TARGET.stat().st_size>20000
print('PDF_RENDERED',TARGET.stat().st_size,'bytes')
