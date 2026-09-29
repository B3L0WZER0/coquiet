#!/bin/sh
# Turns footage that can't loop (light fading, clouds building) into one that
# does: above LINE and below it each play a slice of the clip forward then back,
# eased to a stop at both ends, and meet on a 16px feather. The result goes to
# ambient-inbox/src/<id>.mp4 with `looped: true` on the scene.
#
# usage: scripts/cinemagraph.sh SRC OUT HALF LINE TOP_FROM TOP_TO LOW_FROM LOW_TO
#   HALF   seconds each way (the loop is twice this)
#   LINE   y of the split, in source pixels (a shoreline or horizon)
#   *_FROM *_TO  source frames (25 fps) each layer plays
# The coast: scripts/cinemagraph.sh LTX_2.3_i2v_00013_.mp4 coast.mp4 14 442 55 105 30 130
set -e
SRC=$1; OUT=$2; T=$3; LINE=$4
SIZE=$(ffprobe -v error -select_streams v -show_entries stream=width,height -of csv=s=x:p=0 "$SRC")

layer() { # from to name — dense 96 fps slice, eased over T, then mirrored
  N=$(( ($2 - $1) * 96 / 25 ))
  echo "[0:v]trim=start_frame=$1:end_frame=$2,setpts=PTS-STARTPTS,minterpolate=fps=96:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1,setpts='$T/PI*acos(1-2*N/$N)/TB',fps=24,trim=duration=$T,split[$3f][$3r0];[$3r0]reverse,trim=start_frame=1,setpts=PTS-STARTPTS[$3r];[$3f][$3r]concat=n=2:v=1"
}

ffmpeg -v error -y -i "$SRC" -f lavfi -i "color=black:s=$SIZE,format=gray" -an -filter_complex "
$(layer "$5" "$6" t),format=rgb24[top];
$(layer "$7" "$8" l),format=yuv420p[low];
[1:v]geq=lum='255*clip(($LINE-Y)/16+0.5\,0\,1)'[mk];[top][mk]alphamerge[topm];
[low][topm]overlay=shortest=1,format=yuv420p" -c:v libx264 -crf 14 -preset slow "$OUT"
