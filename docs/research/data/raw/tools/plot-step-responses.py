#!/usr/bin/env python3
"""Analyze recorded step probes; never generate or interpolate missing flight results."""
import argparse, csv, hashlib, json, gzip, struct
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

P = argparse.ArgumentParser()
P.add_argument('raw', type=Path)
P.add_argument('out', type=Path)
P.add_argument('--run-map', type=Path)
P.add_argument('--rate-folder-suffix', default='-small')
P.add_argument('--protocol-label', default='')
P.add_argument('--matched-rates', action='store_true')
a = P.parse_args(); a.out.mkdir(parents=True, exist_ok=True)
run_map=json.loads(a.run_map.read_text()) if a.run_map else {}
colors = {'cognipilot':'#479cff', 'betaflight':'#ff8b32'}
specs = [('attitude-step','Roll attitude step','Roll angle (deg)',1.2),
         ('rate-step','Acro roll-rate step','Body roll rate (deg/s)',0.4),
         ('position-step','Position step','East position (m)',10.)]
summary = {'scope':'Single noise-free roll/positive-east diagnostic per stack; not a tuning qualification or hardware timing result', 'flights':[]}
plt.rcParams.update({'figure.facecolor':'#0b0e12','axes.facecolor':'#111720','text.color':'#ecf0f4','axes.labelcolor':'#ecf0f4','xtick.color':'#afbac9','ytick.color':'#afbac9','axes.edgecolor':'#455269','font.size':11,'savefig.facecolor':'#0b0e12'})
fig, axes = plt.subplots(3,1,figsize=(11,12),constrained_layout=True)
for ax,(shape,title,ylabel,hold) in zip(axes,specs):
    for stack,color in colors.items():
        folder=a.raw/run_map.get(f'{stack}-{shape}', f'{stack}-{shape}{a.rate_folder_suffix}' if shape=='rate-step' else f'{stack}-{shape}')
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
        item={'stack':stack,'test':shape,'attempt_id':folder.name,'completed_and_landed':report['passed'],
              'error':report.get('error'),'baseline':baseline,'target':target,
              'rise_10_90_s':None if t10 is None or t90 is None else t90-t10,
              'first_90_percent_s':t90,'settling_5_percent_s':settle,
              'overshoot_percent':max(0.,float((np.max(yy)-target)/abs(span)*100)) if len(yy) else None,
              'end_of_hold_error':float(target-np.mean(yy[tt>=hold-.1])) if len(yy) else None,
              'hold_window_s':hold,'requested_command_hold_observed_s':float(t[np.flatnonzero((t>=0)&(np.abs(cmd-target)<1e-6))[-1]]+.000625) if np.any((t>=0)&(np.abs(cmd-target)<1e-6)) else None,'hashes':report['hashes'],
              'raw_step_sha256':hashlib.sha256((folder/'step-response.csv').read_bytes()).hexdigest()}
        if a.protocol_label:
            trajectory=np.genfromtxt(folder/'trajectory.csv',delimiter=',',names=True)
            motors=np.array([trajectory['m'+str(i)] for i in range(4)])
            residual=float(np.max(np.abs(motors*1999-np.rint(motors*1999))))
            assert residual<0.001, f'DShot quantization lost in {folder}: {residual}'
            item['max_dshot_integer_code_residual']=residual
            if stack=='betaflight':
                trace_path=folder/'actuator-trace.bin.gz'
                trace=gzip.decompress(trace_path.read_bytes()) if trace_path.exists() else (folder/'actuator-trace.bin').read_bytes()
                first,last=200000,208000
                writes=lambda tick:struct.unpack_from('<I',trace,(tick-1)*64+56)[0]
                item['observed_motor_writes_25_to_26_s']=writes(last)-writes(first)
                item['pid_period_readback_us']=report['sensor_profile']['pid_period_readback_us']
                assert report['sensor_profile']['motor_protocol_readback']=='DSHOT600'
        if a.matched_rates:
            profile=report['sensor_profile']
            counts=dict(zip(profile['measured_counter_names'], profile['measured_counts_25_to_26_s']))
            expected={'gyro_reads':1600,'accel_reads':1600,'attitude_updates':1600,'motor_writes':1600,'transport_ticks':8000} if stack=='betaflight' else {'motor_publications':1600,'sensor_motor_exchanges':1600,'navigation_steps':1600,'guidance_steps':1600}
            assert counts==expected, f'Unverified rates: {folder}: {counts}'
            if stack=='betaflight':
                assert item['observed_motor_writes_25_to_26_s']==1600
                assert item['pid_period_readback_us']==625
                counters=np.frombuffer(trace,dtype=np.dtype({'names':['motor_updates'],'formats':['<u4'],'offsets':[56],'itemsize':64}))['motor_updates'][first-1:last]
                increments=np.diff(counters.astype(np.int64))
                assert np.all((increments==0)|(increments==1)), 'Skipped or duplicate motor updates'
                update_ticks=np.flatnonzero(increments==1)
                intervals=np.diff(update_ticks)*125
                assert len(intervals)>1000 and np.all(intervals==625), 'Nonuniform BF motor schedule'
                item['observed_motor_interval_us']={'min':int(intervals.min()),'max':int(intervals.max())}
            item['verified_rate_counts_25_to_26_s']=counts
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
if a.matched_rates:
    assert len(summary['flights'])==6, 'All six recorded flights are required for the matched-rate figure'
    for key in ['config','plant','plant_description','offboard','runner']:
        assert len({f['hashes'][key] for f in summary['flights']})==1, f'Mixed {key} in comparison'
fig.suptitle('CogniPilot vs Betaflight · recorded ARM step responses\nTROPIC RT1064 · FastDyn/QEMU · shared Rumoca plant' + ('\n'+a.protocol_label if a.protocol_label else ''),fontsize=16)
if a.protocol_label:
    fig.supxlabel('Single noise-free probes · plant-truth feedback · ' + ('matched 1.6 kHz schedule' if a.matched_rates else 'execution/ingress rates differ') + ' · not hardware latency', fontsize=9)
fig.savefig(a.out/'step-responses.png',dpi=170)
fig.savefig(a.out/'step-responses.svg')
summary['attempts'] = []
ids={p.parent.name for p in a.raw.glob('*/report.json')} | {p.stem for p in a.raw.glob('*.exit')}
for identity in sorted(ids):
    report_path=a.raw/identity/'report.json'
    report=json.loads(report_path.read_text()) if report_path.exists() and report_path.stat().st_size else {}
    log_path=a.raw/(identity+'.log')
    log=log_path.read_text(errors='replace') if log_path.exists() else ''
    summary['attempts'].append(dict(id=identity, passed=report.get('passed',False),
        error=report.get('error') if report else ('No space left on device; incomplete execution, no report produced' if 'No space left on device' in log else 'Incomplete execution; no report produced'),
        simulated_seconds=report.get('simulated_seconds'), hashes=report.get('hashes')))
summary['status'] = f"{sum(f['completed_and_landed'] for f in summary['flights'])}/{len(summary['flights'])} displayed flights completed and landed. {len(summary['attempts'])} total attempts retained, {sum(not f['passed'] for f in summary['attempts'])} failed attempts."
if any('No space left' in (f['error'] or '') for f in summary['attempts']):
    summary['status'] += ' Storage failures are retained as incomplete executions, not controller-performance failures.'
(a.out/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps(summary['flights'],indent=2))
