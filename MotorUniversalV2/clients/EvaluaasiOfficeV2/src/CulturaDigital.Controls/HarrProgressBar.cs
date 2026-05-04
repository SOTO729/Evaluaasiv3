using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Windows.Forms;
using CulturaDigital.Models.Extensions;

namespace CulturaDigital.Controls;

public class HarrProgressBar : Panel
{
	private Color StatusColor1;

	private Color StatusColor2;

	private int _StatusBarColorIndex;

	private Color FirstColor;

	private Color SecondColor;

	private int _FillDegree = 50;

	private bool _isDragging;

	private int _DDradius = 40;

	private int _mX;

	private int _mY;

	public int OpcionId { get; set; }

	public int PreguntaId { get; set; }

	public int Orden { get; set; }

	public bool Correcta { get; set; }

	public bool Seleccionada { get; set; }

	public int OrdenSeleccionado { get; set; }

	public int RoundedCornerAngle { get; set; }

	public int LeftBarSize { get; set; }

	public int RightBarSize { get; set; }

	public int StatusBarSize { get; set; }

	public new Padding Padding { get; set; }

	public new Font Font { get; set; }

	public string MainText { get; set; }

	public string LeftText { get; set; }

	public string RightText { get; set; }

	public string StatusText { get; set; }

	public int StatusBarColor
	{
		get
		{
			return _StatusBarColorIndex;
		}
		set
		{
			switch (value)
			{
			case 0:
				StatusColor1 = Color.OliveDrab;
				StatusColor2 = Color.DarkOliveGreen;
				break;
			case 1:
				StatusColor1 = Color.OliveDrab;
				StatusColor2 = Color.Gray;
				break;
			case 2:
				StatusColor1 = Color.Goldenrod;
				StatusColor2 = Color.DarkGoldenrod;
				break;
			case 3:
				StatusColor1 = Color.Goldenrod;
				StatusColor2 = Color.Gray;
				break;
			default:
				StatusColor1 = Color.DimGray;
				StatusColor2 = Color.DimGray;
				break;
			}
		}
	}

	public int FillDegree
	{
		get
		{
			return _FillDegree;
		}
		set
		{
			if (value >= 100)
			{
				FirstColor = Color.FromArgb(0, 55, 104);
				SecondColor = Color.FromArgb(0, 152, 194);
			}
			else if (value > 90)
			{
				FirstColor = Color.Gold;
				SecondColor = Color.DarkGoldenrod;
			}
			else if (value > 80)
			{
				FirstColor = Color.Orange;
				SecondColor = Color.DarkOrange;
			}
			else
			{
				FirstColor = Color.Red;
				SecondColor = Color.DarkRed;
			}
			_FillDegree = value;
		}
	}

	public bool AllowDrag { get; set; }

	public HarrProgressBar()
	{
		Font = new Font("Arial", 10f);
		FillDegree = 50;
		RoundedCornerAngle = 10;
		base.Margin = new Padding(2);
		LeftText = "LT";
		StatusText = "Not set";
		MainText = "MainText";
		RightText = "RT";
		LeftBarSize = 30;
		StatusBarSize = 60;
		RightBarSize = 30;
		StatusBarColor = 99;
		AllowDrag = true;
	}

	protected override void OnGotFocus(EventArgs e)
	{
		BackColor = Color.SandyBrown;
		base.OnGotFocus(e);
	}

	protected override void OnLostFocus(EventArgs e)
	{
		BackColor = Color.Transparent;
		base.OnLostFocus(e);
	}

	protected override void OnClick(EventArgs e)
	{
		Focus();
		base.OnClick(e);
	}

	protected override void OnMouseDown(MouseEventArgs e)
	{
		Focus();
		base.OnMouseDown(e);
		_mX = e.X;
		_mY = e.Y;
		_isDragging = false;
	}

	protected override void OnMouseMove(MouseEventArgs e)
	{
		if (_isDragging)
		{
			return;
		}
		if (e.Button == MouseButtons.Left && _DDradius > 0 && AllowDrag)
		{
			int num = _mX - e.X;
			int num2 = _mY - e.Y;
			if (num * num + num2 * num2 > _DDradius)
			{
				DoDragDrop(this, DragDropEffects.All);
				_isDragging = true;
				return;
			}
		}
		base.OnMouseMove(e);
	}

	protected override void OnMouseUp(MouseEventArgs e)
	{
		_isDragging = false;
		base.OnMouseUp(e);
	}

	protected override void OnPaint(PaintEventArgs e)
	{
		base.OnPaint(e);
		paintThisShit(e.Graphics);
	}

	public void paintThisShit(Graphics _graphics)
	{
		StringFormat stringFormat = new StringFormat();
		stringFormat.Alignment = StringAlignment.Center;
		stringFormat.LineAlignment = StringAlignment.Center;
		_graphics = CreateGraphics();
		LinearGradientBrush linearGradientBrush = new LinearGradientBrush(GetMainArea(), Color.DimGray, Color.Black, LinearGradientMode.Vertical);
		LinearGradientBrush linearGradientBrush2 = new LinearGradientBrush(GetMainArea(), StatusColor1, StatusColor2, LinearGradientMode.Vertical);
		LinearGradientBrush linearGradientBrush3 = new LinearGradientBrush(GetMainArea(), FirstColor, SecondColor, LinearGradientMode.Vertical);
		if (LeftBarSize > 0)
		{
			_graphics.FillRoundedRectangle(linearGradientBrush, GetLeftArea(), RoundedCornerAngle, (RectangleEdgeFilter)5);
			_graphics.DrawString(LeftText, Font, Brushes.White, GetLeftArea(), stringFormat);
		}
		if (StatusBarSize > 0)
		{
			_graphics.FillRoundedRectangle(linearGradientBrush2, GetStatusArea(), RoundedCornerAngle, RectangleEdgeFilter.None);
			_graphics.DrawString(StatusText, Font, Brushes.White, GetStatusArea(), stringFormat);
		}
		_graphics.FillRoundedRectangle(Brushes.Transparent, GetMainArea(), RoundedCornerAngle, RectangleEdgeFilter.None);
		_graphics.DrawString(MainText, Font, Brushes.White, GetMainAreaBackground(), stringFormat);
		if (RightBarSize > 0)
		{
			_graphics.FillRoundedRectangle(linearGradientBrush, GetRightArea(), RoundedCornerAngle, (RectangleEdgeFilter)10);
			_graphics.DrawString(RightText, Font, Brushes.White, GetRightArea(), stringFormat);
		}
		linearGradientBrush.Dispose();
		linearGradientBrush3.Dispose();
		linearGradientBrush2.Dispose();
	}

	private Rectangle GetLeftArea()
	{
		return new Rectangle(Padding.Left, Padding.Top, LeftBarSize, base.ClientRectangle.Height - Padding.Bottom - Padding.Top);
	}

	private Rectangle GetStatusArea()
	{
		return new Rectangle(Padding.Left + LeftBarSize, Padding.Top, StatusBarSize, base.ClientRectangle.Height - Padding.Bottom - Padding.Top);
	}

	private Rectangle GetMainArea()
	{
		return new Rectangle(Padding.Left + LeftBarSize + StatusBarSize, Padding.Top, Convert.ToInt32((base.ClientRectangle.Width - (Padding.Left + LeftBarSize + StatusBarSize + RightBarSize + Padding.Right)) * FillDegree / 100), base.ClientRectangle.Height - Padding.Bottom - Padding.Top);
	}

	private Rectangle GetMainAreaBackground()
	{
		return new Rectangle(Padding.Left + LeftBarSize + StatusBarSize, Padding.Top, base.ClientRectangle.Width - (Padding.Left + LeftBarSize + StatusBarSize + RightBarSize + Padding.Right), base.ClientRectangle.Height - Padding.Bottom - Padding.Top);
	}

	private Rectangle GetRightArea()
	{
		return new Rectangle(base.ClientRectangle.Width - (RightBarSize + Padding.Right), Padding.Top, RightBarSize, base.ClientRectangle.Height - Padding.Bottom - Padding.Top);
	}
}
