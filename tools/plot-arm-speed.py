"""Plot retained measured data only; never launches or modifies simulations."""
import csv
import json
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

root = Path(__file__).resolve().parents[1]
folder = root / 'docs/results/arm-speed'
attempts = json.loads((folder / 'betaflight-attempts.json').read_text())
screen = sorted([a for a in attempts if a['id'].startswith(('coarse-', 'refine-'))], key=lambda a:a['config']['course']['lap_time_s'])
with (folder/'betaflight-33s/trajectory.csv').open() as f:
    successful=list(csv.DictReader(f))
with (folder/'failed-landing-harsh-2.csv').open() as f:
    failed=list(csv.DictReader(f))
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':11,'figure.facecolor':'#10151d','axes.facecolor':'#10151d','text.color':'#edf2f7','axes.labelcolor':'#edf2f7','xtick.color':'#b9c5d4','ytick.color':'#b9c5d4','axes.edgecolor':'#617086','svg.fonttype':'none'})
fig, axes=plt.subplots(1,2,figsize=(13,5.4))
fig.subplots_adjust(left=.07,right=.98,bottom=.22,top=.76,wspace=.30)
fig.suptitle('Faster tracking does not guarantee a completed flight',x=.07,ha='left',y=.97,fontsize=19,weight='bold')
fig.text(.07,.88,'Betaflight · TROPIC RT1064 / Cortex-M7 · FastDyn/QEMU + shared Rumoca plant',fontsize=11)
fig.text(.07,.83,'10 × 10 m at 2 m · inherited K = 6/s · 33 s and 34 s candidates: each passed 13 / 15 confirmations',fontsize=11,color='#b9c5d4')
a=axes[0]
x=[r['config']['course']['lap_time_s'] for r in screen];y=[r['report']['tracking_max_m'] for r in screen]
a.plot(x,y,color='#ff922b',marker='o',label='Realistic-noise screening, seed 1')
a.axhline(.75,color='#ff6b6b',ls='--',lw=1.4,label='0.75 m maximum-error limit')
a.set(xlabel='Requested reference lap (s)',ylabel='Maximum course tracking error (m)',title='Shorter requested laps increase error',xticks=[30,32,33,34,35,40])
a.grid(alpha=.15);a.legend(fontsize=8,loc='upper right',facecolor='#10151d',edgecolor='#617086',labelcolor='#edf2f7')
a=axes[1]
for rows,label,color,style in [(successful,'Passed: realistic noise, seed 1','#ff922b','-'),(failed,'Failed: harsh noise, seed 2','#ff6b6b','--')]:
    rows=[r for r in rows if float(r['time_s'])>=60]
    a.plot([float(r['time_s']) for r in rows],[float(r['z_m']) for r in rows],color=color,ls=style,label=label)
a.axhline(.13,color='#b9c5d4',ls=':',lw=1,label='Ground-verification height threshold')
a.set(xlabel='Simulated time, takeoff through landing (s)',ylabel='Recorded altitude (m)',title='One failed run stays airborne',xlim=(60,76),ylim=(0,2.4))
a.grid(alpha=.15);a.legend(fontsize=8,loc='upper right',facecolor='#10151d',edgecolor='#617086',labelcolor='#edf2f7')
fig.text(.07,.10,'33 s: harsh seeds 2 and 3 failed landing. 34 s: harsh seeds 2 and 5 failed. Slower candidates are still being tested.',fontsize=10)
fig.text(.07,.05,'Exploratory ARM evidence · current-target tuning remains open · no hardware latency or superiority claim · November 6, 2026',fontsize=9,color='#b9c5d4')
fig.savefig(folder/'speed-and-landing.svg')
fig.savefig('/private/tmp/adr-speed-and-landing.png',dpi=160)
