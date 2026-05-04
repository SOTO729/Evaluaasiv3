using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Runtime.InteropServices;

namespace CulturaDigital.Models.Extensions;

internal static class GraphicsExtension
{
	private class FontMetricsImpl : FontMetrics
	{
		public struct TEXTMETRIC
		{
			public int tmHeight;

			public int tmAscent;

			public int tmDescent;

			public int tmInternalLeading;

			public int tmExternalLeading;

			public int tmAveCharWidth;

			public int tmMaxCharWidth;

			public int tmWeight;

			public int tmOverhang;

			public int tmDigitizedAspectX;

			public int tmDigitizedAspectY;

			public char tmFirstChar;

			public char tmLastChar;

			public char tmDefaultChar;

			public char tmBreakChar;

			public byte tmItalic;

			public byte tmUnderlined;

			public byte tmStruckOut;

			public byte tmPitchAndFamily;

			public byte tmCharSet;
		}

		private TEXTMETRIC metrics;

		public override int Height => metrics.tmHeight;

		public override int Ascent => metrics.tmAscent;

		public override int Descent => metrics.tmDescent;

		public override int InternalLeading => metrics.tmInternalLeading;

		public override int ExternalLeading => metrics.tmExternalLeading;

		public override int AverageCharacterWidth => metrics.tmAveCharWidth;

		public override int MaximumCharacterWidth => metrics.tmMaxCharWidth;

		public override int Weight => metrics.tmWeight;

		public override int Overhang => metrics.tmOverhang;

		public override int DigitizedAspectX => metrics.tmDigitizedAspectX;

		public override int DigitizedAspectY => metrics.tmDigitizedAspectY;

		[DllImport("gdi32.dll", CharSet = CharSet.Unicode)]
		public static extern IntPtr SelectObject(IntPtr hdc, IntPtr hgdiobj);

		[DllImport("gdi32.dll", CharSet = CharSet.Unicode)]
		public static extern bool GetTextMetrics(IntPtr hdc, out TEXTMETRIC lptm);

		[DllImport("gdi32.dll", CharSet = CharSet.Unicode)]
		public static extern bool DeleteObject(IntPtr hdc);

		private TEXTMETRIC GenerateTextMetrics(Graphics graphics, Font font)
		{
			IntPtr intPtr = IntPtr.Zero;
			IntPtr intPtr2 = IntPtr.Zero;
			try
			{
				intPtr = graphics.GetHdc();
				intPtr2 = font.ToHfont();
				IntPtr hgdiobj = SelectObject(intPtr, intPtr2);
				GetTextMetrics(intPtr, out var lptm);
				SelectObject(intPtr, hgdiobj);
				return lptm;
			}
			finally
			{
				if (intPtr2 != IntPtr.Zero)
				{
					DeleteObject(intPtr2);
				}
				if (intPtr != IntPtr.Zero)
				{
					graphics.ReleaseHdc(intPtr);
				}
			}
		}

		private FontMetricsImpl(Graphics graphics, Font font)
		{
			metrics = GenerateTextMetrics(graphics, font);
		}

		public static FontMetrics GetFontMetrics(Graphics graphics, Font font)
		{
			return new FontMetricsImpl(graphics, font);
		}
	}

	private static GraphicsPath GenerateRoundedRectangle(this Graphics graphics, RectangleF rectangle, float radius, RectangleEdgeFilter filter)
	{
		GraphicsPath graphicsPath = new GraphicsPath();
		if (radius <= 0f || filter == RectangleEdgeFilter.None)
		{
			graphicsPath.AddRectangle(rectangle);
			graphicsPath.CloseFigure();
			return graphicsPath;
		}
		if ((double)radius >= (double)Math.Min(rectangle.Width, rectangle.Height) / 2.0)
		{
			return graphics.GenerateCapsule(rectangle);
		}
		float num = radius * 2f;
		RectangleF rect = new RectangleF(size: new SizeF(num, num), location: rectangle.Location);
		if ((RectangleEdgeFilter.TopLeft & filter) == RectangleEdgeFilter.TopLeft)
		{
			graphicsPath.AddArc(rect, 180f, 90f);
		}
		else
		{
			graphicsPath.AddLine(rect.X, rect.Y + rect.Height, rect.X, rect.Y);
			graphicsPath.AddLine(rect.X, rect.Y, rect.X + rect.Width, rect.Y);
		}
		rect.X = rectangle.Right - num;
		if ((RectangleEdgeFilter.TopRight & filter) == RectangleEdgeFilter.TopRight)
		{
			graphicsPath.AddArc(rect, 270f, 90f);
		}
		else
		{
			graphicsPath.AddLine(rect.X, rect.Y, rect.X + rect.Width, rect.Y);
			graphicsPath.AddLine(rect.X + rect.Width, rect.Y + rect.Height, rect.X + rect.Width, rect.Y);
		}
		rect.Y = rectangle.Bottom - num;
		if ((RectangleEdgeFilter.BottomRight & filter) == RectangleEdgeFilter.BottomRight)
		{
			graphicsPath.AddArc(rect, 0f, 90f);
		}
		else
		{
			graphicsPath.AddLine(rect.X + rect.Width, rect.Y, rect.X + rect.Width, rect.Y + rect.Height);
			graphicsPath.AddLine(rect.X, rect.Y + rect.Height, rect.X + rect.Width, rect.Y + rect.Height);
		}
		rect.X = rectangle.Left;
		if ((RectangleEdgeFilter.BottomLeft & filter) == RectangleEdgeFilter.BottomLeft)
		{
			graphicsPath.AddArc(rect, 90f, 90f);
		}
		else
		{
			graphicsPath.AddLine(rect.X + rect.Width, rect.Y + rect.Height, rect.X, rect.Y + rect.Height);
			graphicsPath.AddLine(rect.X, rect.Y + rect.Height, rect.X, rect.Y);
		}
		graphicsPath.CloseFigure();
		return graphicsPath;
	}

	private static GraphicsPath GenerateCapsule(this Graphics graphics, RectangleF rectangle)
	{
		GraphicsPath graphicsPath = new GraphicsPath();
		try
		{
			if (rectangle.Width > rectangle.Height)
			{
				float height = rectangle.Height;
				RectangleF rect = new RectangleF(size: new SizeF(height, height), location: rectangle.Location);
				graphicsPath.AddArc(rect, 90f, 180f);
				rect.X = rectangle.Right - height;
				graphicsPath.AddArc(rect, 270f, 180f);
			}
			else if (rectangle.Width < rectangle.Height)
			{
				float height = rectangle.Width;
				RectangleF rect = new RectangleF(size: new SizeF(height, height), location: rectangle.Location);
				graphicsPath.AddArc(rect, 180f, 180f);
				rect.Y = rectangle.Bottom - height;
				graphicsPath.AddArc(rect, 0f, 180f);
			}
			else
			{
				graphicsPath.AddEllipse(rectangle);
			}
		}
		catch
		{
			graphicsPath.AddEllipse(rectangle);
		}
		finally
		{
			graphicsPath.CloseFigure();
		}
		return graphicsPath;
	}

	public static void DrawRoundedRectangle(this Graphics graphics, Pen pen, float x, float y, float width, float height, float radius, RectangleEdgeFilter filter)
	{
		RectangleF rectangle = new RectangleF(x, y, width, height);
		GraphicsPath path = graphics.GenerateRoundedRectangle(rectangle, radius, filter);
		SmoothingMode smoothingMode = graphics.SmoothingMode;
		graphics.SmoothingMode = SmoothingMode.AntiAlias;
		graphics.DrawPath(pen, path);
		graphics.SmoothingMode = smoothingMode;
	}

	public static void DrawRoundedRectangle(this Graphics graphics, Pen pen, float x, float y, float width, float height, float radius)
	{
		graphics.DrawRoundedRectangle(pen, x, y, width, height, radius, RectangleEdgeFilter.All);
	}

	public static void DrawRoundedRectangle(this Graphics graphics, Pen pen, int x, int y, int width, int height, int radius)
	{
		graphics.DrawRoundedRectangle(pen, Convert.ToSingle(x), Convert.ToSingle(y), Convert.ToSingle(width), Convert.ToSingle(height), Convert.ToSingle(radius));
	}

	public static void DrawRoundedRectangle(this Graphics graphics, Pen pen, Rectangle rectangle, int radius, RectangleEdgeFilter filter)
	{
		graphics.DrawRoundedRectangle(pen, rectangle.X, rectangle.Y, rectangle.Width, rectangle.Height, radius, filter);
	}

	public static void DrawRoundedRectangle(this Graphics graphics, Pen pen, Rectangle rectangle, int radius)
	{
		graphics.DrawRoundedRectangle(pen, rectangle.X, rectangle.Y, rectangle.Width, rectangle.Height, radius, RectangleEdgeFilter.All);
	}

	public static void DrawRoundedRectangle(this Graphics graphics, Pen pen, RectangleF rectangle, int radius, RectangleEdgeFilter filter)
	{
		graphics.DrawRoundedRectangle(pen, rectangle.X, rectangle.Y, rectangle.Width, rectangle.Height, radius, filter);
	}

	public static void DrawRoundedRectangle(this Graphics graphics, Pen pen, RectangleF rectangle, int radius)
	{
		graphics.DrawRoundedRectangle(pen, rectangle.X, rectangle.Y, rectangle.Width, rectangle.Height, radius, RectangleEdgeFilter.All);
	}

	public static void FillRoundedRectangle(this Graphics graphics, Brush brush, float x, float y, float width, float height, float radius, RectangleEdgeFilter filter)
	{
		RectangleF rectangle = new RectangleF(x, y, width, height);
		GraphicsPath path = graphics.GenerateRoundedRectangle(rectangle, radius, filter);
		SmoothingMode smoothingMode = graphics.SmoothingMode;
		graphics.SmoothingMode = SmoothingMode.AntiAlias;
		graphics.FillPath(brush, path);
		graphics.SmoothingMode = smoothingMode;
	}

	public static void FillRoundedRectangle(this Graphics graphics, Brush brush, float x, float y, float width, float height, float radius)
	{
		graphics.FillRoundedRectangle(brush, x, y, width, height, radius, RectangleEdgeFilter.All);
	}

	public static void FillRoundedRectangle(this Graphics graphics, Brush brush, int x, int y, int width, int height, int radius)
	{
		graphics.FillRoundedRectangle(brush, Convert.ToSingle(x), Convert.ToSingle(y), Convert.ToSingle(width), Convert.ToSingle(height), Convert.ToSingle(radius));
	}

	public static void FillRoundedRectangle(this Graphics graphics, Brush brush, Rectangle rectangle, int radius, RectangleEdgeFilter filter)
	{
		graphics.FillRoundedRectangle(brush, rectangle.X, rectangle.Y, rectangle.Width, rectangle.Height, radius, filter);
	}

	public static void FillRoundedRectangle(this Graphics graphics, Brush brush, Rectangle rectangle, int radius)
	{
		graphics.FillRoundedRectangle(brush, rectangle.X, rectangle.Y, rectangle.Width, rectangle.Height, radius, RectangleEdgeFilter.All);
	}

	public static void FillRoundedRectangle(this Graphics graphics, Brush brush, RectangleF rectangle, int radius, RectangleEdgeFilter filter)
	{
		graphics.FillRoundedRectangle(brush, rectangle.X, rectangle.Y, rectangle.Width, rectangle.Height, radius, filter);
	}

	public static void FillRoundedRectangle(this Graphics graphics, Brush brush, RectangleF rectangle, int radius)
	{
		graphics.FillRoundedRectangle(brush, rectangle.X, rectangle.Y, rectangle.Width, rectangle.Height, radius, RectangleEdgeFilter.All);
	}

	public static FontMetrics GetFontMetrics(this Graphics graphics, Font font)
	{
		return FontMetricsImpl.GetFontMetrics(graphics, font);
	}
}
