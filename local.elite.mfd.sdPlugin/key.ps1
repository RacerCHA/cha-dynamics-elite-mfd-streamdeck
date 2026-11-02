param([string]$Action,[switch]$Preview)
$ErrorActionPreference='Stop'
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class MfdKeyboard {
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h,out uint pid);
 [DllImport("user32.dll")] public static extern void keybd_event(byte vk,byte scan,uint flags,UIntPtr extra);
 [DllImport("user32.dll")] public static extern uint MapVirtualKey(uint code,uint type);
}
"@
$folder=Join-Path $env:LOCALAPPDATA 'Frontier Developments/Elite Dangerous/Options/Bindings'
$preset=@(Get-Content (Join-Path $folder 'StartPreset.4.start'))[1]
if($preset -ne 'Custom'){exit 1}
$xml=[xml](Get-Content -Raw -Encoding UTF8 (Join-Path $folder 'Custom.4.2.binds'))
$keymap=@{Space=32;Home=36;Insert=45;Equals=187;LeftShift=160;LeftControl=162;LeftAlt=164;RightShift=161;RightControl=163;RightAlt=165}
for($i=1;$i -le 12;$i++){$keymap["F$i"]=111+$i}
$ru='йцукенгшщзхъфывапролджэячсмитьбю'
$vk=@(81,87,69,82,84,89,85,73,79,80,219,221,65,83,68,70,71,72,74,75,76,186,222,90,88,67,86,66,78,77,188,190)
for($i=0;$i -lt $ru.Length;$i++){$keymap[[string]$ru[$i]]=$vk[$i]}
function Code($key){
 $s=$key -replace '^Key_',''
 if($keymap.ContainsKey($s)){return $keymap[$s]}
 if($s -cmatch '^[a-zA-Z0-9]$'){return [int][char]$s.ToUpperInvariant()}
 throw 'Unsupported binding'
}
$bindings=@($xml.Root.$Action.Primary,$xml.Root.$Action.Secondary)
if($Action -eq 'ToggleCargoScoop'){
 # Prefer the overlay-safe alternative and never fall back to Home.
 $bindings=@($xml.Root.$Action.Secondary,$xml.Root.$Action.Primary) | Where-Object {
  $_.Key -ne 'Key_Home' -and -not $_.SelectSingleNode("Modifier[@Key='Key_Home']")
 }
}
$b=$bindings|Where-Object {$_.Device -eq 'Keyboard'}|Select-Object -First 1
if(!$b){exit 1}
$keys=@(foreach($mod in $b.SelectNodes('Modifier')){if($mod.Device -ne 'Keyboard'){exit 1};Code $mod.Key});$keys+=Code $b.Key
function EmitKey($scan,$flags){
 if($Preview){ Write-Output "$scan/$flags";return }
 [MfdKeyboard]::keybd_event(0,$scan,$flags,[UIntPtr]::Zero)
}
[uint32]$front=0
[void][MfdKeyboard]::GetWindowThreadProcessId([MfdKeyboard]::GetForegroundWindow(),[ref]$front)
if(!$Preview -and (Get-Process -Id $front).ProcessName -ne 'EliteDangerous64'){exit 1}
$held=@()
try{foreach($k in $keys){$scan=[MfdKeyboard]::MapVirtualKey($k,0);$ext=if($k -in 36,45,163,165){1}else{0};EmitKey $scan (8+$ext);$held+=,@($scan,$ext)};Start-Sleep -Milliseconds 65}
finally{[array]::Reverse($held);foreach($k in $held){EmitKey $k[0] (10+$k[1])}}
