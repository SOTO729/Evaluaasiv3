using System.Windows.Forms;

namespace CulturaDigital.Models.Extensions;

public static class PanelExtensions
{
	public static void IniciarPanel(this Panel Elemento)
	{
		Elemento.Visible = false;
		Elemento.SendToBack();
		Elemento.Dock = DockStyle.Fill;
	}

	public static void IniciarPanel(ref Panel Elemento)
	{
		Elemento.Visible = false;
		Elemento.SendToBack();
		Elemento.Dock = DockStyle.Fill;
	}
}
