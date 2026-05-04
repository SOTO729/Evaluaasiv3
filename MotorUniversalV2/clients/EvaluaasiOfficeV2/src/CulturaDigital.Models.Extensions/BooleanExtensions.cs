using System.Windows.Forms;

namespace CulturaDigital.Models.Extensions;

public static class BooleanExtensions
{
	public static void IniciarPanel(this bool visible, ref Panel Elemento)
	{
		if (visible)
		{
			Elemento.Visible = true;
			Elemento.BringToFront();
		}
		else
		{
			Elemento.Visible = false;
			Elemento.SendToBack();
		}
	}

	public static void IniciarPanel(this bool visible, ref Panel Elemento, int ancho, int alto)
	{
		if (visible)
		{
			Elemento.Visible = true;
			Elemento.BringToFront();
			Elemento.Width = ancho - 180;
			Elemento.Height = alto - 70;
			Elemento.Margin = new Padding(80, 50, 80, 0);
		}
		else
		{
			Elemento.Visible = false;
			Elemento.SendToBack();
			Elemento.Dock = DockStyle.Fill;
		}
	}
}
