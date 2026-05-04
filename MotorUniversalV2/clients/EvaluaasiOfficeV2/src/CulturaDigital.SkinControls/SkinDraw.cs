using System.Drawing;

namespace CulturaDigital.SkinControls;

public class SkinDraw
{
	public static ContentAlignment anyRight = (ContentAlignment)1092;

	public static ContentAlignment anyTop = (ContentAlignment)7;

	public static ContentAlignment anyBottom = (ContentAlignment)1792;

	public static ContentAlignment anyCenter = (ContentAlignment)546;

	public static ContentAlignment anyMiddle = (ContentAlignment)112;

	internal static void DrawRect1(Graphics g, ImageObject obj, Rectangle r, int index)
	{
		if (obj.img != null)
		{
			int x = (index - 1) * obj.Width;
			int y = 0;
			int left = r.Left;
			int top = r.Top;
			g.DrawImage(srcRect: new Rectangle(x, y, obj.Width, obj.Height), destRect: new Rectangle(left, top, r.Width, r.Height), image: obj.img, srcUnit: GraphicsUnit.Pixel);
		}
	}

	internal static void DrawRect2(Graphics g, ImageObject obj, Rectangle r, int index)
	{
		if (obj.img == null)
		{
			return;
		}
		int num = (index - 1) * obj.Width;
		int num2 = 0;
		int left = r.Left;
		int top = r.Top;
		if (r.Height > obj.Height && r.Width <= obj.Width)
		{
			g.DrawImage(srcRect: new Rectangle(num, num2, obj.Width, obj.lr.Top), destRect: new Rectangle(left, top, r.Width, obj.lr.Top), image: obj.img, srcUnit: GraphicsUnit.Pixel);
			Rectangle srcRect = new Rectangle(num, num2 + obj.lr.Top, obj.Width, obj.Height - obj.lr.Top - obj.lr.Bottom);
			Rectangle destRect = new Rectangle(left, top + obj.lr.Top, r.Width, r.Height - obj.lr.Top - obj.lr.Bottom);
			if (obj.lr.Top + obj.lr.Bottom == 0)
			{
				srcRect.Height--;
			}
			g.DrawImage(obj.img, destRect, srcRect, GraphicsUnit.Pixel);
			g.DrawImage(srcRect: new Rectangle(num, num2 + obj.Height - obj.lr.Bottom, obj.Width, obj.lr.Bottom), destRect: new Rectangle(left, top + r.Height - obj.lr.Bottom, r.Width, obj.lr.Bottom), image: obj.img, srcUnit: GraphicsUnit.Pixel);
		}
		else if (r.Height <= obj.Height && r.Width > obj.Width)
		{
			g.DrawImage(srcRect: new Rectangle(num, num2, obj.lr.Left, obj.Height), destRect: new Rectangle(left, top, obj.lr.Left, r.Height), image: obj.img, srcUnit: GraphicsUnit.Pixel);
			g.DrawImage(srcRect: new Rectangle(num + obj.lr.Left, num2, obj.Width - obj.lr.Left - obj.lr.Right, obj.Height), destRect: new Rectangle(left + obj.lr.Left, top, r.Width - obj.lr.Left - obj.lr.Right, r.Height), image: obj.img, srcUnit: GraphicsUnit.Pixel);
			g.DrawImage(srcRect: new Rectangle(num + obj.Width - obj.lr.Right, num2, obj.lr.Right, obj.Height), destRect: new Rectangle(left + r.Width - obj.lr.Right, top, obj.lr.Right, r.Height), image: obj.img, srcUnit: GraphicsUnit.Pixel);
		}
		else if (r.Height <= obj.Height && r.Width <= obj.Width)
		{
			g.DrawImage(srcRect: new Rectangle((index - 1) * obj.Width, 0, obj.Width, obj.Height - 1), image: obj.img, destRect: new Rectangle(left, top, r.Width, r.Height), srcUnit: GraphicsUnit.Pixel);
		}
		else if (r.Height > obj.Height && r.Width > obj.Width)
		{
			g.DrawImage(srcRect: new Rectangle(num, num2, obj.lr.Left, obj.lr.Top), destRect: new Rectangle(left, top, obj.lr.Left, obj.lr.Top), image: obj.img, srcUnit: GraphicsUnit.Pixel);
			g.DrawImage(srcRect: new Rectangle(num, num2 + obj.Height - obj.lr.Bottom, obj.lr.Left, obj.lr.Bottom), destRect: new Rectangle(left, top + r.Height - obj.lr.Bottom, obj.lr.Left, obj.lr.Bottom), image: obj.img, srcUnit: GraphicsUnit.Pixel);
			g.DrawImage(srcRect: new Rectangle(num, num2 + obj.lr.Top, obj.lr.Left, obj.Height - obj.lr.Top - obj.lr.Bottom), destRect: new Rectangle(left, top + obj.lr.Top, obj.lr.Left, r.Height - obj.lr.Top - obj.lr.Bottom), image: obj.img, srcUnit: GraphicsUnit.Pixel);
			g.DrawImage(srcRect: new Rectangle(num + obj.lr.Left, num2, obj.Width - obj.lr.Left - obj.lr.Right, obj.lr.Top), destRect: new Rectangle(left + obj.lr.Left, top, r.Width - obj.lr.Left - obj.lr.Right, obj.lr.Top), image: obj.img, srcUnit: GraphicsUnit.Pixel);
			g.DrawImage(srcRect: new Rectangle(num + obj.Width - obj.lr.Right, num2, obj.lr.Right, obj.lr.Top), destRect: new Rectangle(left + r.Width - obj.lr.Right, top, obj.lr.Right, obj.lr.Top), image: obj.img, srcUnit: GraphicsUnit.Pixel);
			g.DrawImage(srcRect: new Rectangle(num + obj.Width - obj.lr.Right, num2 + obj.lr.Top, obj.lr.Right, obj.Height - obj.lr.Top - obj.lr.Bottom), destRect: new Rectangle(left + r.Width - obj.lr.Right, top + obj.lr.Top, obj.lr.Right, r.Height - obj.lr.Top - obj.lr.Bottom), image: obj.img, srcUnit: GraphicsUnit.Pixel);
			g.DrawImage(srcRect: new Rectangle(num + obj.Width - obj.lr.Right, num2 + obj.Height - obj.lr.Bottom, obj.lr.Right, obj.lr.Bottom), destRect: new Rectangle(left + r.Width - obj.lr.Right, top + r.Height - obj.lr.Bottom, obj.lr.Right, obj.lr.Bottom), image: obj.img, srcUnit: GraphicsUnit.Pixel);
			g.DrawImage(srcRect: new Rectangle(num + obj.lr.Left, num2 + obj.Height - obj.lr.Bottom, obj.Width - obj.lr.Left - obj.lr.Right, obj.lr.Bottom), destRect: new Rectangle(left + obj.lr.Left, top + r.Height - obj.lr.Bottom, r.Width - obj.lr.Left - obj.lr.Right, obj.lr.Bottom), image: obj.img, srcUnit: GraphicsUnit.Pixel);
			g.DrawImage(srcRect: new Rectangle(num + obj.lr.Left, num2 + obj.lr.Top, obj.Width - obj.lr.Left - obj.lr.Right, obj.Height - obj.lr.Top - obj.lr.Bottom), destRect: new Rectangle(left + obj.lr.Left, top + obj.lr.Top, r.Width - obj.lr.Left - obj.lr.Right, r.Height - obj.lr.Top - obj.lr.Bottom), image: obj.img, srcUnit: GraphicsUnit.Pixel);
		}
	}

	internal static Rectangle HAlignWithin(Size alignThis, Rectangle withinThis, ContentAlignment align)
	{
		if ((align & anyRight) != 0)
		{
			withinThis.X += withinThis.Width - alignThis.Width;
		}
		else if ((align & anyCenter) != 0)
		{
			withinThis.X += (withinThis.Width - alignThis.Width + 1) / 2;
		}
		withinThis.Width = alignThis.Width;
		return withinThis;
	}

	internal static Rectangle VAlignWithin(Size alignThis, Rectangle withinThis, ContentAlignment align)
	{
		if ((align & anyBottom) != 0)
		{
			withinThis.Y += withinThis.Height - alignThis.Height;
		}
		else if ((align & anyMiddle) != 0)
		{
			withinThis.Y += (withinThis.Height - alignThis.Height + 1) / 2;
		}
		withinThis.Height = alignThis.Height;
		return withinThis;
	}
}
