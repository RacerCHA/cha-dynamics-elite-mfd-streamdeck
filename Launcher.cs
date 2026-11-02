using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
class Launcher {
 static int Main(string[] args) {
  string dir=AppDomain.CurrentDomain.BaseDirectory;
  var start=new ProcessStartInfo(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),"nodejs","node.exe"));
  start.WorkingDirectory=Path.GetTempPath();
  start.Arguments="\""+Path.Combine(dir,"panel.js")+"\" "+String.Join(" ",args.Select(s=>"\""+s.Replace("\"","\\\"")+"\""));
  start.UseShellExecute=false;start.CreateNoWindow=true;
  using(var p=Process.Start(start)){p.WaitForExit();return p.ExitCode;}
 }
}
