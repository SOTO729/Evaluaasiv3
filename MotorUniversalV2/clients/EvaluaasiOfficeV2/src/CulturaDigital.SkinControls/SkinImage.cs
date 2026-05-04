using System;
using System.ComponentModel;
using System.Drawing;

namespace CulturaDigital.SkinControls;

public class SkinImage : Component
{
	public static ImageObject button;

	public static ImageObject checkbox;

	public static ImageObject radiobutton;

	private Schemes scheme;

	public Schemes Scheme
	{
		get
		{
			return scheme;
		}
		set
		{
			scheme = value;
			try
			{
				switch (scheme)
				{
				case Schemes.MacOs:
					Macskin();
					break;
				case Schemes.Xp:
					Xp1skin();
					break;
				case Schemes.Plex:
					Plexskin();
					break;
				}
			}
			catch (Exception)
			{
			}
		}
	}

	static SkinImage()
	{
		Macskin();
	}

	protected static void Macskin()
	{
		button = new ImageObject(5, Rectangle.FromLTRB(14, 11, 14, 11), 1);
		checkbox = new ImageObject(12, new Rectangle(0, 0, 0, 0), 3);
		radiobutton = new ImageObject(8, new Rectangle(0, 0, 0, 0), 2);
	}

	protected static void Xp1skin()
	{
		button = new ImageObject("CulturaDigital.SkinControls.xp1_button.png", 5, Rectangle.FromLTRB(8, 9, 8, 9));
		checkbox = new ImageObject("CulturaDigital.SkinControls.xp1_checkbox.png", 12, new Rectangle(0, 0, 0, 0));
		radiobutton = new ImageObject("CulturaDigital.SkinControls.xp1_radiobutton.png", 8, new Rectangle(0, 0, 0, 0));
	}

	protected static void Plexskin()
	{
		button = new ImageObject("CulturaDigital.SkinControls.Plex_button.png", 5, Rectangle.FromLTRB(8, 9, 8, 9));
		checkbox = new ImageObject("CulturaDigital.SkinControls.Plex_checkbox.png", 12, new Rectangle(0, 0, 0, 0));
		radiobutton = new ImageObject("CulturaDigital.SkinControls.Plex_radiobutton.png", 8, new Rectangle(0, 0, 0, 0));
	}

	protected override void Dispose(bool disposing)
	{
		base.Dispose(disposing);
	}
}
