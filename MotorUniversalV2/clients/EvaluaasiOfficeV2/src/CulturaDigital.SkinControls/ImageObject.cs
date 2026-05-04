using System.Drawing;
using System.IO;
using System.Reflection;
using CulturaDigital.Properties;

namespace CulturaDigital.SkinControls;

public class ImageObject
{
	public Bitmap img;

	public int Width;

	public int Height;

	public int Count;

	public Rectangle lr;

	public ImageObject(int count, Rectangle r, int tipo)
	{
		Count = count;
		lr = r;
		switch (tipo)
		{
		case 1:
			img = new Bitmap(Resources.mac_checkbox);
			break;
		case 2:
			img = new Bitmap(Resources.mac_radiobutton);
			break;
		case 3:
			img = new Bitmap(Resources.mac_button);
			break;
		}
		if (img != null)
		{
			Width = img.Width / Count;
			Height = img.Height;
		}
	}

	public ImageObject(string str, int count, Rectangle r)
	{
		Count = count;
		lr = r;
		if (img != null)
		{
			Width = img.Width / Count;
			Height = img.Height;
		}
	}

	~ImageObject()
	{
		if (img != null)
		{
			img.Dispose();
		}
	}

	protected Stream FindStream(string str)
	{
		Assembly executingAssembly = Assembly.GetExecutingAssembly();
		string[] manifestResourceNames = executingAssembly.GetManifestResourceNames();
		foreach (string text in manifestResourceNames)
		{
			if (text == str)
			{
				return executingAssembly.GetManifestResourceStream(text);
			}
		}
		return null;
	}

	protected Bitmap GetResBitmap(string str)
	{
		Stream stream = FindStream(str);
		if (stream == null)
		{
			return null;
		}
		return new Bitmap(stream);
	}
}
