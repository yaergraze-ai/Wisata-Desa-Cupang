from docx import Document
from docx.shared import Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH
from io import BytesIO
from pathlib import Path
import urllib.request
import subprocess
import os

base=Path(__file__).resolve().parents[1]
source=base/'Proposal_APBO_Wisata_Desa_Cupang_Kana_Nurhana_Naskah_Bersih.docx'
target=base/'Proposal_APBO_Wisata_Desa_Cupang_Kana_Nurhana_Lengkap.pdf'
doc=Document(source)
logo_url='https://disposisi.umc.ac.id/assets/images/umc.png'
logo=base/'_umc_cover.png'

try:
    req=urllib.request.Request(logo_url,headers={'User-Agent':'Mozilla/5.0'})
    with urllib.request.urlopen(req,timeout=20) as response:
        data=response.read()
    if data[:8] == b'\x89PNG\r\n\x1a\n':
        logo.write_bytes(data)
except Exception as ex:
    print('Logo: unduhan tidak berhasil; cover memakai judul institusi',ex)

for p in doc.paragraphs:
    if '[TEMPAT LOGO RESMI' in p.text:
        p.clear()
        p.alignment=WD_ALIGN_PARAGRAPH.CENTER
        if logo.exists():
            p.add_run().add_picture(str(logo),width=Cm(3.8))
        else:
            p.add_run('UNIVERSITAS MUHAMMADIYAH CIREBON')
    # No drafting instructions should appear as prose in final proposal:
    if p.text.strip().startswith('Daftar isi disusun sesuai urutan bab.'):
        p.clear()

docx_clean=base/'_proposal_pdf_export.docx'
doc.save(docx_clean)
out=base/'_pdf_out';out.mkdir(exist_ok=True)
subprocess.run(['libreoffice','-env:UserInstallation=file:///tmp/lo_apbo_pdf','--headless','--convert-to','pdf','--outdir',str(out),str(docx_clean)],check=True,timeout=120)
rendered=out/'_proposal_pdf_export.pdf'
assert rendered.is_file() and rendered.stat().st_size>10000
target.write_bytes(rendered.read_bytes())
print('PDF:',target,'size:',target.stat().st_size)
