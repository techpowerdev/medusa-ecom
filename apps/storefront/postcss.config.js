// SFUI-1a (spec 09 กฎ 1): Tailwind v4 ใช้ PostCSS plugin ตัวเดียว (จัดการ vendor prefix เอง — เลิก autoprefixer)
module.exports = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
}
