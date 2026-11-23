from pathlib import Path
import qrcode
import qrcode.image.svg
import zxingcpp

URL = 'https://maeil-silcheon.baze.cloud/'
output = Path('.baze-files/outputs')
output.mkdir(parents=True, exist_ok=True)
qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=20, border=4)
qr.add_data(URL)
qr.make(fit=True)
image = qr.make_image(fill_color='black', back_color='white')
png = output / '매일실천_휴대폰설치_QR.png'
image.save(png)
svg = output / '매일실천_휴대폰설치_QR.svg'
qr.make_image(image_factory=qrcode.image.svg.SvgPathImage).save(svg)
decoded = zxingcpp.read_barcode(image.get_image())
if not decoded or decoded.text != URL:
    raise RuntimeError('QR 검증 실패')
print(f'QR decoded and verified: {decoded.text}')
print(png)
print(svg)
