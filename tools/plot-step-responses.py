#!/usr/bin/env python3
"""Analyze recorded step probes; never generate or interpolate missing flight results."""
import argparse, csv, hashlib, json
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

P = argparse.ArgumentParser()
P.add_argument('raw', type=Path)
P.add_argument('out', type=Path)
a = P.parse_args(); a.out.mkdir(parents=True, exist_ok=True)
colors = {'cognipilot':'#479cff', 'betaflight':'#ff8b32'}
specs = [('attitude-step','Roll attitude step','Roll angle (deg)',1.2),
         ('rate-step','Acro roll-rate step','Body roll rate (deg/s)',0.4),
         ('position-step','Position step','East position (m)',10.)]
summary = {'scope':'Single noise-free roll/positive-east diagnostic per stack; not a tuning qualification or hardware timing result', 'flights':[]}
plt.rcParams.update({'figure.facecolor':'#0b0e12','axes.facecolor':'#111720','text.color':'#ecf0f4','axes.labelcolor':'#ecf0f4','xtick.color':'#afbac9','ytick.color':'#afbac9','axes.edgecolor':'#455269','font.size':11,'savefig.facecolor':'#0b0e12'})
fig, axes = plt.subplots(3,1,figsize=(11,12),constrained_layout=True)
for ax,(shape,title,ylabel,hold) in zip(axes,specs):
    for stack,color in colors.items():
        folder=a.raw/(f'{stack}-{shape}-small' if shape=='rate-step' else f'{stack}-{shape}')
        if not (folder/'report.json').exists(): continue
        report=json.loads((folder/'report.json').read_text())
        d=np.genfromtxt(folder/'step-response.csv',delimiter=',',names=True)
        assert len(d)>0 and np.all(np.diff(d['time_s'])>0), f'Non-monotonic or empty log: {folder}'
        assert np.all(np.isfinite(d['time_s'])), f'Invalid timestamps: {folder}'
        t=d['time_s']-25
        if shape=='attitude-step':
            cmd=np.rad2deg(d['roll_command_rad']); y=np.rad2deg(d['roll_rad']); target=5.
        elif shape=='rate-step':
            cmd=np.rad2deg(d['rate_roll_command_rad_s']); y=np.rad2deg(d['gyro_roll_rad_s']); target=10.
        else:
            cmd=d['ref_x_m']; y=d['x_m']; target=.5
        pre=(t>=-.2)&(t<0); baseline=float(np.mean(y[pre]))
        mask=(t>=0)&(t<hold-0.01)
        tt=t[mask]; yy=y[mask]; span=target-baseline
        def crossing(frac):
            idx=np.flatnonzero(yy>=baseline+span*frac)
            return float(tt[idx[0]]) if len(idx) else None
        t10,t90=crossing(.1),crossing(.9)
        band=.05*abs(span)
        outside=np.flatnonzero(np.abs(yy-target)>band)
        settle=None
        if len(tt) and (len(outside)==0 or outside[-1]<len(tt)-1):
            start=0 if len(outside)==0 else outside[-1]+1
            if tt[-1]-tt[start]>=.1: settle=float(tt[start])
        item={'stack':stack,'test':shape,'completed_and_landed':report['passed'],
              'error':report.get('error'),'baseline':baseline,'target':target,
              'rise_10_90_s':None if t10 is None or t90 is None else t90-t10,
              'first_90_percent_s':t90,'settling_5_percent_s':settle,
              'overshoot_percent':max(0.,float((np.max(yy)-target)/abs(span)*100)) if len(yy) else None,
              'end_of_hold_error':float(target-np.mean(yy[tt>=hold-.1])) if len(yy) else None,
              'hold_window_s':hold,'requested_command_hold_observed_s':float(t[np.flatnonzero((t>=0)&(np.abs(cmd-target)<1e-6))[-1]]+.000625) if np.any((t>=0)&(np.abs(cmd-target)<1e-6)) else None,'hashes':report['hashes'],
              'raw_step_sha256':hashlib.sha256((folder/'step-response.csv').read_bytes()).hexdigest()}
        summary['flights'].append(item)
        view=(t>=-.1)&(t<=(hold+.19 if shape=='rate-step' else hold-.001))
        ax.plot(t[view],y[view],color=color,lw=2,label=('CogniPilot' if stack=='cognipilot' else 'Betaflight')+' measured')
        ax.plot(t[view],cmd[view],color=color,lw=1,ls='--',alpha=.7,label=('CogniPilot' if stack=='cognipilot' else 'Betaflight')+' requested')
        # Small complete-window CSV for easy independent inspection; full-rate raw stays in archive.
        with (a.out/f'{stack}-{shape}.csv').open('w') as f:
            writer=csv.writer(f); writer.writerow(['time_from_step_s','requested','measured'])
            writer.writerows(zip(t[view],cmd[view],y[view]))
    ax.set(title=title,xlabel='Time from command step (s)',ylabel=ylabel)
    ax.axvline(0,color='#afbac9',lw=.8); ax.axvline(hold,color='#afbac9',lw=.8,ls=':')
    ax.grid(alpha=.15); ax.legend(fontsize=9,ncol=2)
fig.suptitle('CogniPilot vs Betaflight · recorded ARM step responses\nTROPIC RT1064 · FastDyn/QEMU · shared Rumoca plant',fontsize=16)
fig.savefig(a.out/'step-responses.png',dpi=170)
fig.savefig(a.out/'step-responses.svg')
summary['attempts'] = [dict(id=p.parent.name, **{k:json.loads(p.read_text()).get(k) for k in ['passed','error','simulated_seconds','hashes']}) for p in sorted(a.raw.glob('*/report.json'))]
summary['status'] = f"{sum(f['completed_and_landed'] for f in summary['flights'])}/{len(summary['flights'])} displayed flights completed and landed. {len(summary['attempts'])} total attempts retained, including the two larger 30°/s Acro probes that hit the tilt limit during position recovery."
(a.out/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps(summary['flights'],indent=2))
