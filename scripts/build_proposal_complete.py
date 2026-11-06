from pathlib import Path
from docx import Document
from docx.shared import Cm, Pt
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from graphviz import Digraph
from PIL import Image
import re

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'Proposal_APBO_Wisata_Desa_Cupang_Kana_Nurhana_FINAL.docx'
SRC=ROOT/'Proposal_APBO_Wisata_Desa_Cupang_Kana_Nurhana_Sitasi_Dan_Diagram.docx'
IMG=ROOT/'diagram_final'; IMG.mkdir(exist_ok=True)
if not SRC.exists(): raise RuntimeError(f'Source not found: {SRC}')
D=Document(SRC)
COMMON=dict(fontname='DejaVu Sans', fontsize='11', color='#24262B', penwidth='1.6')
def base(name,direction='LR'):
    g=Digraph(name,format='png',engine='dot')
    g.attr(rankdir=direction, bgcolor='white', pad='0.4', nodesep='0.5', ranksep='0.7', dpi='180', splines='polyline')
    g.attr('node',shape='box',style='rounded',fontname='DejaVu Sans',fontsize='12',color='#333946',fontcolor='#22242B',penwidth='1.7',margin='0.2,0.15')
    g.attr('edge',fontname='DejaVu Sans',fontsize='10',color='#30353C',fontcolor='#202329',arrowsize='0.7',penwidth='1.35')
    return g
pics=[]
def finish(g,name,anchor,caption):
    fp=Path(g.render(filename=name,directory=str(IMG),cleanup=True))
    assert fp.exists() and Image.open(fp).width>200
    pics.append((str(fp),anchor,caption))

g=base('DFD_Konteks')
g.node('w','Wisatawan\n(Member)',shape='box')
g.node('sys','P0\nSISTEM INFORMASI\nWISATA DESA CUPANG',shape='ellipse',fontsize='14',style='filled',fillcolor='#F2F3F5')
for key,label in [('pt','Petugas Gerbang'),('ad','Admin'),('sa','Super Admin'),('md','Layanan Pembayaran\n(Midtrans)')]:g.node(key,label)
g.edge('w','sys',label='Pilihan tiket, tanggal,\njumlah, data pemesan')
g.edge('sys','w',label='Informasi wisata, kuota,\nstatus pesanan, e-tiket')
g.edge('pt','sys',label='Kode QR, lokasi gerbang')
g.edge('sys','pt',label='Hasil validasi dan riwayat')
g.edge('ad','sys',label='Informasi, foto,\ntarif, kuota')
g.edge('sys','ad',label='Data pesanan, laporan')
g.edge('sa','sys',label='Pengguna, peran')
g.edge('sys','sa',label='Status dan audit')
g.edge('sys','md',label='Permintaan pembayaran')
g.edge('md','sys',label='Notifikasi status transaksi')
finish(g,'01_Diagram_Konteks','3.6 Diagram Konteks (DFD)','Gambar 3.1 Diagram Konteks Sistem Informasi Wisata Desa Cupang')

g=base('UseCase',direction='LR')
g.node('w','Wisatawan / Member',shape='plaintext');g.node('pt','Petugas Gerbang',shape='plaintext')
g.node('ad','Admin',shape='plaintext');g.node('sa','Super Admin',shape='plaintext');g.node('md','Midtrans',shape='plaintext')
with g.subgraph(name='cluster_system') as s:
    s.attr(label='Sistem Informasi Wisata Desa Cupang',color='#B4BAC6',style='rounded',fontsize='15')
    for k,t in [('info','Lihat informasi\ndan galeri'),('pesan','Pesan tiket'),('kuota','Periksa kuota'),('total','Hitung total'),('bayar','Bayar pesanan'),('et','Lihat e-tiket'),('qr','Validasi QR'),('scan','Catat hasil scan'),('edit','Kelola destinasi,\nfoto, tarif, kuota'),('report','Lihat laporan'),('akun','Kelola pengguna\n dan hak akses'),('conf','Konfirmasi pembayaran'),('issue','Terbitkan e-tiket')]:
        s.node(k,t,shape='ellipse',style='filled',fillcolor='#FBFBFC')
for a,b in [('w','info'),('w','pesan'),('w','bayar'),('w','et'),('pt','qr'),('ad','edit'),('ad','report'),('sa','akun'),('md','conf')]:g.edge(a,b,dir='none')
for a,b in [('pesan','kuota'),('pesan','total'),('qr','scan')]:g.edge(a,b,label='«include»',style='dashed',constraint='false')
g.edge('conf','issue',label='bila berhasil',style='dashed')
finish(g,'02_Use_Case','3.7.1 Use Case Diagram','Gambar 3.2 Use Case Diagram Wisata Desa Cupang')

g=base('ActivityPemesanan',direction='TB')
g.node('start','Mulai',shape='oval');g.node('a','Wisatawan membuka informasi\nBatu Lawang atau Gunung Bendera')
g.node('b','Pilih jenis tiket,\ntanggal, jumlah')
g.node('quota','Kuota tersedia?',shape='diamond')
g.node('fail1','Tampilkan kuota habis')
g.node('reserve','Simpan pesanan PENDING\ndan cadangkan kuota')
g.node('pay','Lakukan pembayaran Midtrans')
g.node('notify','Sistem memverifikasi\nnotifikasi pembayaran')
g.node('ok','Pembayaran berhasil?',shape='diamond')
g.node('fail2','Status gagal/kedaluwarsa;\nlepas kuota sesuai aturan')
g.node('ticket','Terbitkan e-tiket\nQR unik')
g.node('arrival','Wisatawan datang\nmenunjukkan QR')
g.node('scan','Petugas memindai QR')
g.node('valid','Tanggal, gerbang, status,\npenggunaan sesuai?',shape='diamond')
g.node('deny','Catat pemeriksaan ditolak')
g.node('accept','Catat tiket diterima')
g.node('end','Selesai',shape='oval')
for a,b in [('start','a'),('a','b'),('b','quota'),('reserve','pay'),('pay','notify'),('notify','ok'),('ticket','arrival'),('arrival','scan'),('scan','valid'),('accept','end'),('deny','end'),('fail1','end'),('fail2','end')]:g.edge(a,b)
g.edge('quota','fail1',label='Tidak');g.edge('quota','reserve',label='Ya')
g.edge('ok','fail2',label='Tidak');g.edge('ok','ticket',label='Ya')
g.edge('valid','deny',label='Tidak');g.edge('valid','accept',label='Ya')
finish(g,'03_Activity_Pemesanan','3.7.2 Activity Diagram Pemesanan','Gambar 3.3 Activity Diagram Pemesanan Tiket')

g=base('ActivityAdmin',direction='TB')
for a,txt,shape in [('start','Mulai','oval'),('login','Admin login','box'),('auth','Hak akses valid?','diamond'),('deny','Akses ditolak','box'),('home','Dashboard Admin','box'),('menu','Pilih menu','diamond'),('gallery','Kelola informasi dan galeri wisata','box'),('tickets','Kelola produk tiket, tarif, kuota','box'),('reports','Lihat transaksi dan laporan','box'),('check','Validasi data perubahan','box'),('valid','Data valid?','diamond'),('err','Tampilkan pesan kesalahan','box'),('save','Simpan perubahan','box'),('audit','Catat riwayat perubahan','box'),('logout','Logout','box'),('end','Selesai','oval')]:g.node(a,txt,shape=shape)
g.edge('start','login');g.edge('login','auth');g.edge('auth','deny',label='Tidak');g.edge('deny','end')
g.edge('auth','home',label='Ya');g.edge('home','menu');g.edge('menu','gallery');g.edge('menu','tickets');g.edge('menu','reports')
g.edge('gallery','check');g.edge('tickets','check');g.edge('check','valid')
g.edge('valid','err',label='Tidak');g.edge('err','home');g.edge('valid','save',label='Ya');g.edge('save','audit');g.edge('audit','home')
g.edge('reports','home');g.edge('home','logout',constraint='false');g.edge('logout','end')
finish(g,'04_Activity_Pengelolaan','3.7.3 Activity Diagram Pengelolaan','Gambar 3.4 Activity Diagram Pengelolaan Admin')

g=base('ClassDiagram',direction='TB')
classes=[
('Pengguna',['+ id: String','+ nama: String','+ email: String','+ peran: Role']),
('Destinasi',['+ id: String','+ nama: String','+ deskripsi: String','+ lokasi: String']),
('FotoDestinasi',['+ url: String','+ keterangan: String']),
('KuotaHarian',['+ tanggal: Date','+ kapasitas: int','+ terpesan: int']),
('Pesanan',['+ nomor: String','+ tanggalKunjung: Date','+ status: Status','+ total: Decimal']),
('ItemPesanan',['+ jumlah: int','+ hargaSatuan: Decimal']),
('ProdukTiket',['+ id: String','+ nama: String','+ izinGerbang: String']),
('TarifTiket',['+ hargaDasar: Decimal','+ biayaTambahan: Decimal','+ berlakuMulai: Date']),
('Pembayaran',['+ referensi: String','+ status: Status']),
('Tiket',['+ kodePublik: String','+ tanggal: Date','+ status: Status']),
('PemindaianGerbang',['+ waktu: DateTime','+ gerbang: String','+ hasil: String'])
]
for cl,fields in classes:g.node(cl,cl+'\\n'+'\\n'.join(fields),shape='record',style='filled',fillcolor='#FAFAFA')
for a,b,l in [('Pengguna','Pesanan','1 : banyak'),('Destinasi','FotoDestinasi','1 : banyak'),('Destinasi','KuotaHarian','1 : banyak'),('Pesanan','ItemPesanan','1 : banyak'),('ItemPesanan','ProdukTiket','banyak : 1'),('ProdukTiket','TarifTiket','1 : banyak'),('Pesanan','Pembayaran','1 : 0..1'),('Pesanan','Tiket','1 : banyak'),('Tiket','PemindaianGerbang','1 : banyak')]:g.edge(a,b,label=l,arrowhead='none')
finish(g,'05_Class_Diagram','3.7.4 Class Diagram','Gambar 3.5 Class Diagram Wisata Desa Cupang')

g=base('ERD',direction='TB')
tables=[
('PENGGUNA','PK id\\nnama\\nemail\\nperan'),
('DESTINASI','PK id\\nnama\\ndeskripsi\\nlokasi'),
('FOTO_DESTINASI','PK id\\nFK destinasi_id\\nurl'),
('KUOTA_HARIAN','PK id\\nFK destinasi_id\\ntanggal\\nkapasitas'),
('PESANAN','PK id\\nFK pengguna_id\\nstatus\\ntotal'),
('ITEM_PESANAN','PK id\\nFK pesanan_id\\nFK produk_id\\njumlah'),
('PRODUK_TIKET','PK id\\nnama\\nizin_gerbang'),
('TARIF_TIKET','PK id\\nFK produk_id\\nharga_dasar'),
('PEMBAYARAN','PK id\\nFK pesanan_id\\nstatus'),
('TIKET','PK id\\nFK pesanan_id\\nkode_publik'),
('PEMINDAIAN_GERBANG','PK id\\nFK tiket_id\\nwaktu\\nhasil')]
for key,fields in tables:g.node(key,key+'\\n'+fields,shape='record',style='filled',fillcolor='#FAFAFA')
for a,b,l in [('PENGGUNA','PESANAN','1:N'),('DESTINASI','FOTO_DESTINASI','1:N'),('DESTINASI','KUOTA_HARIAN','1:N'),('PESANAN','ITEM_PESANAN','1:N'),('PRODUK_TIKET','ITEM_PESANAN','1:N'),('PRODUK_TIKET','TARIF_TIKET','1:N'),('PESANAN','PEMBAYARAN','1:1'),('PESANAN','TIKET','1:N'),('TIKET','PEMINDAIAN_GERBANG','1:N')]:g.edge(a,b,label=l,arrowhead='none')
finish(g,'06_ERD','3.8 Rancangan Basis Data','Gambar 3.6 Entity Relationship Diagram Basis Data')

# Insert six pictures directly beneath their subheadings; preserve all original content.
for path,anchor,caption in pics:
    target=next((p for p in D.paragraphs if p.text.strip()==anchor),None)
    if target is None:
        target=next((p for p in D.paragraphs if p.text.strip().startswith(anchor)),None)
    if target is None:raise RuntimeError('Missing heading '+anchor)
    picture=D.add_paragraph()
    picture.alignment=WD_ALIGN_PARAGRAPH.CENTER
    im=Image.open(path)
    w=min(13.3,19.0*im.width/im.height)
    picture.add_run().add_picture(path,width=Cm(w))
    picture._p.getparent().remove(picture._p)
    target._p.addnext(picture._p)
    cap=D.add_paragraph(caption)
    cap.alignment=WD_ALIGN_PARAGRAPH.CENTER
    cap.paragraph_format.space_after=Pt(8)
    cap.runs[0].italic=True
    cap.runs[0].font.size=Pt(10)
    cap._p.getparent().remove(cap._p)
    picture._p.addnext(cap._p)

for p in D.paragraphs:
    t=p.text.strip()
    # Remove internal editorial instructions from academic body.
    if t.startswith('Daftar isi disusun sesuai urutan bab.'):
        p.text=''
    if t.startswith('Dokumen ini menggunakan A4, Times New Roman'):
        p.text='Data lokasi, foto, jadwal, tarif, kapasitas, serta aturan kunjungan yang digunakan di dalam aplikasi akan diperiksa bersama pengelola wisata sebelum diterbitkan untuk pengunjung.'
    if t.startswith('Sebagai bagian dari dokumen Word, representasi diagram disajikan'):
        p.text='Diagram sistem disusun berdasarkan alur informasi dan transaksi. Diagram Konteks memperlihatkan kesatuan luar, Use Case menunjukkan fungsi pengguna, Activity menggambarkan proses, Class memperlihatkan kelas perangkat lunak, dan ERD menjelaskan hubungan data.'
    if re.match(r'BAB (IV|V|VI)\s*LAMPIRAN',t):
        p.text=re.sub(r'^BAB (IV|V|VI)\s*','',t)

# Bibliography: ensure real DOI references appear, only insert when missing.
existing='\\n'.join(p.text for p in D.paragraphs)
references=[
('Rizkianto & Nasrulloh (2024)', 'Rizkianto, E., & Nasrulloh, S. F. (2024). Rancang bangun sistem informasi desa wisata rintisan Cikaso berbasis website. JATI. https://doi.org/10.36040/jati.v8i5.11054'),
('Tambak et al. (2023)', 'Tambak, S. B., Musrifah, A., Yulianto, A., & Wangi, I. P. (2023). Analisa metode PIECES untuk perancangan sistem informasi pariwisata berbasis web dengan menggunakan model Waterfall. REMIK. https://doi.org/10.33395/remik.v7i4.13090'),
('Saepudin et al. (2022)', 'Saepudin, S., Pudarwati, E., Warman, C., Sihabudin, S., & Giri, G. (2022). Perancangan arsitektur sistem pemesanan tiket wisata online menggunakan framework Zachman. Jurnal Sisfokom. https://doi.org/10.32736/sisfokom.v11i2.1415'),
('Nugroho et al. (2024)', 'Nugroho, A., Prihandani, K., & Mayasari, R. (2024). Rancang bangun sistem pembelian e-ticket berbasis website dengan konsep server-side rendering menggunakan framework Next JS pada Wisata Telaga Kusuma Jumantono. JATI. https://doi.org/10.36040/jati.v8i4.9960'),
('Mayangsari et al. (2025)', 'Mayangsari, D. R., Firliana, R., & Nugroho, A. (2025). Sistem informasi pemesanan tiket online wisata Goa Jegles. JATI. https://doi.org/10.36040/jati.v9i2.12759'),
('Jefi et al. (2023)', 'Jefi, J., Fahmi, M., Hendri, H., Kholifah, D. N., & Suharjanti, S. (2023). Sistem informasi penjualan tiket masuk wisata Jembatan Cinta berbasis web. INTI Nusa Mandiri. https://doi.org/10.33480/inti.v18i1.4307')]
bibliography=next((p for p in D.paragraphs if p.text.strip().upper()=='DAFTAR PUSTAKA'),None)
if bibliography is None:raise RuntimeError('Missing bibliography')
for intext,full in references:
    if full.split('https://doi.org/')[-1] not in existing:
        pp=D.add_paragraph(full)
        pp.paragraph_format.left_indent=Cm(.8)
        pp.paragraph_format.first_line_indent=Cm(-.8)
        pp._p.getparent().remove(pp._p)
        bibliography._p.addnext(pp._p)
# Add carefully scoped citations to claims that lack them.
patch={
'Sistem informasi pariwisata membantu':'Penggunaan website sebagai media penyediaan informasi dan pengenalan destinasi juga dibahas oleh Rizkianto dan Nasrulloh (2024).',
'E-ticketing adalah proses':'Penerapan layanan e-ticketing pada sektor pariwisata dijelaskan dalam penelitian Nugroho et al. (2024) dan Mayangsari et al. (2025).',
'Pengembangan sistem merupakan':'Pendekatan pengembangan informasi wisata secara bertahap dengan Waterfall turut dibahas oleh Tambak et al. (2023).',
}
for p in D.paragraphs:
    for pref,extra in patch.items():
        if p.text.startswith(pref) and extra not in p.text:
            p.add_run(' '+extra)
D.core_properties.title='Proposal APBO Wisata Desa Cupang — Lengkap dengan Diagram dan Sitasi'
D.core_properties.author='Kana Nurhana'
D.save(OUT)
check=Document(OUT)
assert len(check.inline_shapes)>=6, 'Diagram images absent'
assert OUT.stat().st_size>100000
print('DONE:',OUT.name,OUT.stat().st_size,'bytes',len(check.inline_shapes),'inline images',len(check.paragraphs),'paragraphs')
