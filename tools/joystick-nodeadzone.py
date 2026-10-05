#!/usr/bin/env python3
"""Remove the Linux joystick dead zone of /dev/input/jsN (the interface browsers read gamepads through).

Why: the kernel's HID driver advertises flat = range/16 and fuzz = range/256 for every stick axis and joydev turns that into a built-in dead zone around
the centre (about 12 % of the stick travel for a 0..2048 radio) before the browser, and so ESASIM, sees any value. This script rewrites joydev's per-axis
correction (the same thing `jscal -s` does) with flat = 0 and the full range scaled to -32767..32767. It lasts until the device is re-plugged or the
machine reboots (see tools/99-esasim-joystick.rules to apply it automatically).

Usage:  python3 tools/joystick-nodeadzone.py [--dry-run] [/dev/input/js0 /dev/input/js1 ...]     (no devices = every /dev/input/js*)
Needs read access to the js device (normally the logged-in user has it). No root, nothing is written to disk.
"""
import fcntl, glob, os, struct, sys

JSIOCGAXES = 0x80016a11            # _IOR('j', 0x11, __u8)
JSIOCGCORR = 0x80246a22            # _IOR('j', 0x22, struct js_corr)  (the kernel copies nabs * 36 bytes)
JSIOCSCORR = 0x40246a21            # _IOW('j', 0x21, struct js_corr)
JSIOCGNAME = lambda n: 0x80006a13 | (n << 16)
FMT = "8i hH"                      # struct js_corr { __s32 coef[8]; __s16 prec; __u16 type; }  = 36 bytes
SIZE = struct.calcsize(FMT)

def run(path, dry):
    fd = os.open(path, os.O_RDONLY | os.O_NONBLOCK)
    try:
        n = fcntl.ioctl(fd, JSIOCGAXES, b"\0")[0]
        name = fcntl.ioctl(fd, JSIOCGNAME(128), b"\0" * 128).split(b"\0")[0].decode(errors="replace")
        raw = fcntl.ioctl(fd, JSIOCGCORR, b"\0" * (SIZE * n))
        print(f"{path}: {name}, {n} axes")
        out = b""
        for a in range(n):
            *coef, prec, typ = struct.unpack(FMT, raw[a * SIZE:(a + 1) * SIZE])
            flat = (coef[1] - coef[0]) // 2
            center = (coef[0] + coef[1]) // 2
            t = (1 << 29) // coef[2] if coef[2] else 0
            half = t + 2 * flat                                   # half travel in raw counts
            pct = 100.0 * flat / half if half else 0
            print(f"   axis {a}: centre {center}, dead zone +-{flat} counts ({pct:.1f} % of the travel), fuzz {prec}")
            new = list(coef)
            if half > 0:
                new[0] = new[1] = center
                new[2] = new[3] = (1 << 29) // half
            out += struct.pack(FMT, *new, prec, typ)
        if dry:
            print("   (dry run, nothing changed)"); return
        fcntl.ioctl(fd, JSIOCSCORR, out)
        raw2 = fcntl.ioctl(fd, JSIOCGCORR, b"\0" * (SIZE * n))
        flats = [(struct.unpack(FMT, raw2[a * SIZE:(a + 1) * SIZE])[1] - struct.unpack(FMT, raw2[a * SIZE:(a + 1) * SIZE])[0]) // 2 for a in range(n)]
        print("   dead zone after:", flats, "-> removed" if not any(flats) else "-> NOT removed")
    finally:
        os.close(fd)

if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    dry = "--dry-run" in sys.argv
    for p in (args or sorted(glob.glob("/dev/input/js*"))):
        try: run(p, dry)
        except OSError as e: print(f"{p}: {e}")
