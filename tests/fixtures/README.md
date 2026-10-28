# 测试素材

`shop-test.mp4` 是本地 FFmpeg 6.1.1 生成的 6 秒合成视频（320×240 / 8 fps / H.264），不包含真实店铺、商品或个人数据。用于验证解码/时间点/dHash，不验证语义识别准确率。

生成命令（Git Bash）：

```bash
ffmpeg -hide_banner -loglevel error \
  -f lavfi -i 'testsrc2=size=320x240:rate=8:duration=6' \
  -vf "negate=enable='between(t,2,3.99)',hflip=enable='gte(t,4)'" \
  -an -c:v libx264 -preset veryfast -crf 32 -pix_fmt yuv420p \
  -movflags +faststart -y tests/fixtures/shop-test.mp4
```

运行回归无需安装 FFmpeg，仓库已包含该小文件。
