from pathlib import Path
import json
import shutil
import subprocess
import os
import uuid
import zipfile

ROOT = Path(__file__).resolve().parent
PLUGIN = ROOT / 'local.elite.mfd.sdPlugin'
DIST = ROOT / 'dist'
VERSION = '2.5.1'
ASSETS = ['manifest.json', 'icon.svg', 'cockpit.js', 'panel.js', 'telemetry.js', 'key.ps1']
NAMESPACE = uuid.UUID('8987a743-a358-4637-b9ed-18dc659c3362')


def key_id(name):
    return str(uuid.uuid5(NAMESPACE, name)).upper()


def encode(value):
    return json.dumps(value, ensure_ascii=False).encode('utf-8')


def build():
    DIST.mkdir(exist_ok=True)
    profile = DIST / 'Elite MFD.streamDeckProfile'
    folder = key_id('profile') + '.sdProfile'
    page = key_id('page')
    cells = {}
    for i in range(15):
        cells[f'{i % 5},{i // 5}'] = dict(
            ActionID=key_id(f'key-{i}'), LinkedTitle=True, Name='Экран корабля',
            Plugin=dict(Name='CHA Dynamics MFD для Stream Deck', UUID='local.elite.mfd', Version=VERSION+'.0'),
            Resources={}, Settings={}, State=0, States=[{}], UUID='local.elite.mfd.cell')
    with zipfile.ZipFile(profile, 'w', zipfile.ZIP_DEFLATED) as archive:
        archive.writestr(folder+'/manifest.json', encode(dict(
            Device=dict(Model='20GAA9902', UUID=''), Name='Elite MFD',
            Pages=dict(Current=page.lower(), Default=page.lower(), Pages=[page.lower()]), Version='3.0')))
        archive.writestr(folder+'/Profiles/'+page+'/manifest.json', encode(dict(
            Controllers=[dict(Type='Keypad', Actions=cells)], Name='Elite MFD', Icon='')))
    csc = Path(os.environ['WINDIR']) / 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
    executable = DIST / 'panel.exe'
    subprocess.run([str(csc), '/nologo', '/optimize+', '/debug-', '/platform:x64',
                    '/target:winexe', '/out:'+str(executable), str(ROOT/'Launcher.cs')], check=True)
    package = DIST / 'CHA-Dynamics-MFD.streamDeckPlugin'
    with zipfile.ZipFile(package, 'w', zipfile.ZIP_DEFLATED) as archive:
        for name in ASSETS:
            archive.write(PLUGIN/name, PLUGIN.name+'/'+name)
        for file in [executable, profile]:
            archive.write(file, PLUGIN.name+'/'+file.name)
    shutil.copyfile(profile, DIST/'CHA-Dynamics-MFD.streamDeckProfile')
    print(package.name)


if __name__ == '__main__':
    build()
