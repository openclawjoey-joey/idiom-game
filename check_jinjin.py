import sys, re
sys.stdout.reconfigure(encoding='utf-8')
f = open(r'C:\Users\joeyGMK\lobsterai\Development\idiom-game\idiom-game\data.js', 'r', encoding='utf-8')
c = f.read()
f.close()
m = re.search(r"\{w:'津津有味'[^}]+\}", c)
if m:
    print(m.group(0))
else:
    print('not found')
