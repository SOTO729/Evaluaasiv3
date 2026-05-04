using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;
using CulturaDigital.Forms;

namespace CulturaDigital;

internal static class Program
{
	private static IntPtr handle;

	private static Process pActual;

	private static string appGuid = "c80c0532-93eb-48fa-8210-9f04ade5a5d2";

	[DllImport("User32.dll")]
	private static extern bool SetForegroundWindow(IntPtr hWnd);

	[STAThread]
	private static void Main()
	{
		Application.EnableVisualStyles();
		Application.SetCompatibleTextRenderingDefault(defaultValue: false);
		using Mutex mutex = new Mutex(initiallyOwned: false, "Global\\" + appGuid);
		Thread.Sleep(6500);
		if (!mutex.WaitOne(0, exitContext: false))
		{
			MessageBox.Show("Ya se encuentra iniciada una instancia de esta aplicación");
			return;
		}
		GC.Collect();
		Application.Run(new CulturaDigital_Inicio());
	}
}
