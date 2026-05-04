using System;
using System.ComponentModel;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Windows.Forms;

namespace CulturaDigital.Controls;

public class ToggleButton : Control
{
	public delegate void ToggleButtonStateChanged(object sender, ToggleButtonStateEventArgs e);

	public class ToggleButtonStateEventArgs : EventArgs
	{
		public ToggleButtonStateEventArgs(ToggleButtonState ButtonState)
		{
		}
	}

	public enum ToggleButtonState
	{
		ON,
		OFF
	}

	public enum ToggleButtonStyle
	{
		Android,
		Windows,
		IOS,
		Custom,
		Metallic
	}

	private FileInfo f;

	private Rectangle contentRectangle = Rectangle.Empty;

	private Point[] pts2 = new Point[4];

	private Rectangle controlBounds = Rectangle.Empty;

	private bool justRefresh;

	private Point[] andPoints = new Point[4];

	private Point p1;

	private Point p2;

	private Point p3;

	private Point p4;

	private Color _reflectionColor = Color.FromArgb(180, 255, 255, 255);

	private Color[] _surroundColor = new Color[1] { Color.FromArgb(0, 255, 255, 255) };

	private int tPadx;

	private RectangleF custInnerRect;

	private RectangleF staticInnerRect;

	private bool iosSelected;

	private bool dblclick;

	private bool isMouseDown;

	private Point downpos = Point.Empty;

	private bool isMouseMoved;

	private Point sliderPoint = Point.Empty;

	private int padx;

	private int ipadx = 2;

	private bool switchrec;

	private string activeText = "ON";

	private string inActiveText = "OFF";

	private int slidingAngle = 5;

	private Color activeColor = Color.FromArgb(27, 161, 226);

	private Color sliderColor = Color.Black;

	private Color textColor = Color.White;

	private Color inActiveColor = Color.FromArgb(70, 70, 70);

	private ToggleButtonStyle toggleStyle;

	private ToggleButtonState toggleState = ToggleButtonState.OFF;

	public int Value { get; set; }

	private Rectangle WindowSliderBounds
	{
		get
		{
			_ = Rectangle.Empty;
			if (sliderPoint.X > controlBounds.Right - 15)
			{
				sliderPoint.X = controlBounds.Right - 15;
			}
			if (sliderPoint.X < controlBounds.Left)
			{
				sliderPoint.X = controlBounds.Left;
			}
			return new Rectangle(sliderPoint.X, controlBounds.Y, 15, base.Height);
		}
	}

	public string ActiveText
	{
		get
		{
			return activeText;
		}
		set
		{
			activeText = value;
		}
	}

	public string InActiveText
	{
		get
		{
			return inActiveText;
		}
		set
		{
			inActiveText = value;
		}
	}

	public int SlidingAngle
	{
		get
		{
			return slidingAngle;
		}
		set
		{
			slidingAngle = value;
			Refresh();
		}
	}

	public Color ActiveColor
	{
		get
		{
			return activeColor;
		}
		set
		{
			activeColor = value;
			Refresh();
		}
	}

	public Color SliderColor
	{
		get
		{
			return sliderColor;
		}
		set
		{
			sliderColor = value;
			Refresh();
		}
	}

	public Color TextColor
	{
		get
		{
			return textColor;
		}
		set
		{
			textColor = value;
			Refresh();
		}
	}

	public Color InActiveColor
	{
		get
		{
			return inActiveColor;
		}
		set
		{
			inActiveColor = value;
			Refresh();
		}
	}

	public ToggleButtonStyle ToggleStyle
	{
		get
		{
			return toggleStyle;
		}
		set
		{
			toggleStyle = value;
			justRefresh = false;
			switch (value)
			{
			case ToggleButtonStyle.Android:
				base.Region = new Region(new Rectangle(0, 0, base.Width, base.Height));
				BackColor = Color.FromArgb(32, 32, 32);
				InActiveColor = Color.FromArgb(70, 70, 70);
				SlidingAngle = 8;
				break;
			case ToggleButtonStyle.IOS:
				InActiveColor = Color.WhiteSmoke;
				break;
			}
			Invalidate(invalidateChildren: true);
			Update();
			Refresh();
		}
	}

	[DesignerSerializationVisibility(DesignerSerializationVisibility.Visible)]
	public ToggleButtonState ToggleState
	{
		get
		{
			return toggleState;
		}
		set
		{
			if (toggleState != value)
			{
				RaiseButtonStateChanged();
				toggleState = value;
				Invalidate();
				Refresh();
			}
		}
	}

	public event ToggleButtonStateChanged ButtonStateChanged;

	public ToggleButton()
	{
		SetStyle(ControlStyles.UserPaint | ControlStyles.ResizeRedraw | ControlStyles.SupportsTransparentBackColor | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer, value: true);
		f = FindApplicationFile("screw.png");
	}

	protected override void OnPaint(PaintEventArgs e)
	{
		controlBounds = e.ClipRectangle;
		e.Graphics.ResetClip();
		switch (ToggleStyle)
		{
		case ToggleButtonStyle.Android:
			MinimumSize = new Size(75, 23);
			MaximumSize = new Size(119, 32);
			contentRectangle = e.ClipRectangle;
			BackColor = Color.FromArgb(32, 32, 32);
			DrawAndroidStyle(e);
			break;
		case ToggleButtonStyle.Windows:
			MinimumSize = new Size(65, 23);
			MaximumSize = new Size(119, 32);
			contentRectangle = new Rectangle(e.ClipRectangle.X, e.ClipRectangle.Y, base.Width - 1, base.Height - 1);
			DrawWindowsStyle(e);
			break;
		case ToggleButtonStyle.IOS:
		{
			MinimumSize = new Size(93, 30);
			MaximumSize = new Size(135, 51);
			Rectangle rectangle = new Rectangle(0, 0, base.Width, base.Height);
			contentRectangle = rectangle;
			DrawIOSStyle(e);
			break;
		}
		case ToggleButtonStyle.Custom:
		{
			MinimumSize = new Size(160, 50);
			Rectangle rectangle = new Rectangle(2, 2, base.Width - 3, base.Height - 3);
			contentRectangle = rectangle;
			DrawCustomStyle(e);
			break;
		}
		case ToggleButtonStyle.Metallic:
		{
			MinimumSize = new Size(93, 30);
			MaximumSize = new Size(135, 45);
			Rectangle rectangle = new Rectangle(0, 0, base.Width, base.Height);
			contentRectangle = rectangle;
			DrawMetallicStyle(e);
			break;
		}
		}
		base.OnPaint(e);
	}

	private Point[] AndroidPoints()
	{
		p1 = new Point(padx, contentRectangle.Y);
		if (padx == 0)
		{
			p2 = new Point(padx, contentRectangle.Bottom);
		}
		else
		{
			p2 = new Point(padx - SlidingAngle, contentRectangle.Bottom);
		}
		p4 = new Point(p1.X + contentRectangle.Width / 2, contentRectangle.Y);
		p3 = new Point(p4.X - SlidingAngle, contentRectangle.Bottom);
		if (p4.X == contentRectangle.Right)
		{
			p3 = new Point(p4.X, contentRectangle.Bottom);
		}
		andPoints[0] = p1;
		andPoints[1] = p2;
		andPoints[2] = p3;
		andPoints[3] = p4;
		return andPoints;
	}

	private void DrawAndroidStyle(PaintEventArgs e)
	{
		e.Graphics.ResetClip();
		float emSize = 7f;
		Font font = new Font("Microsoft Sans Serif", emSize);
		contentRectangle = e.ClipRectangle;
		if (!isMouseMoved)
		{
			if (ToggleState == ToggleButtonState.ON)
			{
				padx = contentRectangle.Right - contentRectangle.Width / 2;
			}
			else
			{
				padx = 0;
			}
		}
		using (SolidBrush brush = new SolidBrush(BackColor))
		{
			e.Graphics.FillRectangle(brush, e.ClipRectangle);
		}
		e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
		Color color = ((padx != 0) ? ActiveColor : InActiveColor);
		using (SolidBrush brush2 = new SolidBrush(color))
		{
			e.Graphics.FillPolygon(brush2, AndroidPoints());
		}
		if (padx == 0)
		{
			e.Graphics.DrawString(InActiveText, font, Brushes.White, new PointF(padx + contentRectangle.Width / 2 / 6, contentRectangle.Y + contentRectangle.Height / 4));
		}
		else
		{
			e.Graphics.DrawString(ActiveText, font, Brushes.White, new PointF(padx + contentRectangle.Width / 2 / 4, contentRectangle.Y + contentRectangle.Height / 4));
		}
	}

	private void DrawWindowsStyle(PaintEventArgs e)
	{
		contentRectangle = new Rectangle(e.ClipRectangle.X, e.ClipRectangle.Y, base.Width - 1, base.Height - 1);
		if (!isMouseMoved)
		{
			if (ToggleState == ToggleButtonState.ON)
			{
				sliderPoint = new Point(controlBounds.Right - 15, sliderPoint.Y);
			}
			else
			{
				sliderPoint = new Point(controlBounds.Left, sliderPoint.Y);
			}
		}
		Pen pen = new Pen(Color.FromArgb(159, 159, 159));
		pen.Width = 1.9f;
		e.Graphics.DrawRectangle(pen, contentRectangle);
		e.Graphics.DrawRectangle(pen, Rectangle.Inflate(contentRectangle, -3, -3));
		Rectangle rect = new Rectangle(Rectangle.Inflate(contentRectangle, -3, -3).Left, Rectangle.Inflate(contentRectangle, -3, -3).Y, WindowSliderBounds.Left - Rectangle.Inflate(contentRectangle, -3, -3).Left, Rectangle.Inflate(contentRectangle, -3, -3).Height);
		Rectangle rect2 = new Rectangle(WindowSliderBounds.Right, rect.Y, Rectangle.Inflate(contentRectangle, -3, -3).Right - WindowSliderBounds.Right, rect.Height);
		using (SolidBrush brush = new SolidBrush(ActiveColor))
		{
			e.Graphics.FillRectangle(brush, rect);
		}
		using (SolidBrush brush2 = new SolidBrush(SliderColor))
		{
			e.Graphics.FillRectangle(brush2, WindowSliderBounds);
		}
		using (SolidBrush brush3 = new SolidBrush(InActiveColor))
		{
			e.Graphics.FillRectangle(brush3, rect2);
		}
		BackColor = Color.White;
	}

	private void DrawIOSStyle(PaintEventArgs e)
	{
		BackColor = Color.Transparent;
		e.Graphics.SmoothingMode = SmoothingMode.HighQuality;
		e.Graphics.PixelOffsetMode = PixelOffsetMode.HighQuality;
		Rectangle rectangle = (contentRectangle = new Rectangle(0, 0, base.Width, base.Height));
		if (!isMouseMoved)
		{
			if (ToggleState == ToggleButtonState.ON)
			{
				ipadx = contentRectangle.Right - (contentRectangle.Height - 3);
			}
			else
			{
				ipadx = 2;
			}
		}
		Rectangle rect = new Rectangle(ipadx, rectangle.Y, rectangle.Height - 5, rectangle.Height);
		Rectangle rectangle2 = new Rectangle(base.Width / 6 - 10, base.Height / 2, base.Width / 6 - 10 + (rect.X + rect.Width / 2), base.Height / 2);
		GraphicsPath graphicsPath = new GraphicsPath();
		int num = base.Height;
		graphicsPath.AddArc(rectangle.X, rectangle.Y, num, num, 180f, 90f);
		graphicsPath.AddArc(rectangle.X + rectangle.Width - num, rectangle.Y, num, num, 270f, 90f);
		graphicsPath.AddArc(rectangle.X + rectangle.Width - num, rectangle.Y + rectangle.Height - num, num, num, 0f, 90f);
		graphicsPath.AddArc(rectangle.X, rectangle.Y + rectangle.Height - num, num, num, 90f, 90f);
		base.Region = new Region(graphicsPath);
		GraphicsPath graphicsPath2 = new GraphicsPath();
		num = base.Height / 2;
		graphicsPath2.AddArc(rectangle2.X, rectangle2.Y, num, num, 180f, 90f);
		graphicsPath2.AddArc(rectangle2.X + rectangle2.Width - num, rectangle2.Y, num, num, 270f, 90f);
		graphicsPath2.AddArc(rectangle2.X + rectangle2.Width - num, rectangle2.Y + rectangle2.Height - num, num, num, 0f, 90f);
		graphicsPath2.AddArc(rectangle2.X, rectangle2.Y + rectangle2.Height - num, num, num, 90f, 90f);
		if (ipadx < contentRectangle.Width / 2)
		{
			iosSelected = false;
		}
		else if (ipadx == contentRectangle.Right - (contentRectangle.Height - 3) || ipadx > contentRectangle.Width / 2)
		{
			iosSelected = true;
		}
		Rectangle rect2 = new Rectangle(rectangle.X, rectangle.Y, rectangle.X + rect.Right, rectangle.Height);
		Rectangle rect3 = new Rectangle(rect.X + rect.Width / 2, rectangle.Y, rect.X + rect.Width / 2 + rectangle.Right, rectangle.Height);
		LinearGradientBrush brush = new LinearGradientBrush(rect2, Color.FromArgb(255, 96, 174, 241), Color.FromArgb(255, 96, 174, 241), LinearGradientMode.Vertical);
		LinearGradientBrush brush2 = new LinearGradientBrush(rect2, Color.FromArgb(0, 127, 234), Color.FromArgb(96, 174, 241), LinearGradientMode.Vertical);
		e.Graphics.FillRectangle(brush2, rect2);
		e.Graphics.FillPath(brush, graphicsPath2);
		rectangle2 = new Rectangle(rect.X + rect.Width / 2, base.Height / 2, base.Width / 2 + base.Width / 4 - (rect.X + rect.Width / 2) + base.Height / 2, base.Height / 2);
		graphicsPath2 = new GraphicsPath();
		num = base.Height / 2;
		graphicsPath2.AddArc(rectangle2.X, rectangle2.Y, num, num, 180f, 90f);
		graphicsPath2.AddArc(rectangle2.X + rectangle2.Width - num, rectangle2.Y, num, num, 270f, 90f);
		graphicsPath2.AddArc(rectangle2.X + rectangle2.Width - num, rectangle2.Y + rectangle2.Height - num, num, num, 0f, 90f);
		graphicsPath2.AddArc(rectangle2.X, rectangle2.Y + rectangle2.Height - num, num, num, 90f, 90f);
		brush = new LinearGradientBrush(rect3, Color.FromArgb(238, 238, 238), Color.LightGray, LinearGradientMode.Vertical);
		brush2 = new LinearGradientBrush(rect3, Color.FromArgb(238, 238, 238), Color.Silver, LinearGradientMode.Vertical);
		e.Graphics.FillRectangle(brush2, rect3);
		e.Graphics.FillPath(brush, graphicsPath2);
		if (iosSelected)
		{
			e.Graphics.DrawString(ActiveText, Font, Brushes.White, new PointF(rectangle.Width / 4, contentRectangle.Y + contentRectangle.Height / 4));
		}
		else
		{
			e.Graphics.DrawString(InActiveText, Font, new SolidBrush(Color.FromArgb(123, 123, 123)), new PointF(rectangle.Width / 2, contentRectangle.Y + contentRectangle.Height / 4));
		}
		Color color = ((base.Parent != null) ? base.Parent.BackColor : Color.White);
		e.Graphics.DrawEllipse(new Pen(Color.LightGray, 2f), rect);
		LinearGradientBrush brush3 = new LinearGradientBrush(rect, Color.White, Color.Silver, LinearGradientMode.Vertical);
		e.Graphics.FillEllipse(brush3, rect);
		e.Graphics.DrawPath(new Pen(color, 2f), graphicsPath);
		e.Graphics.ResetClip();
	}

	protected virtual void FillShape(Graphics g, object brush, GraphicsPath path)
	{
		if (brush.GetType().ToString() == "System.Drawing.Drawing2D.LinearGradientBrush")
		{
			g.FillPath((LinearGradientBrush)brush, path);
		}
		else if (brush.GetType().ToString() == "System.Drawing.Drawing2D.PathGradientBrush")
		{
			g.FillPath((PathGradientBrush)brush, path);
		}
	}

	private void DrawMetallicStyle(PaintEventArgs e)
	{
		e.Graphics.SmoothingMode = SmoothingMode.HighQuality;
		e.Graphics.PixelOffsetMode = PixelOffsetMode.HighQuality;
		Rectangle rectangle = (contentRectangle = new Rectangle(0, 0, base.Width, base.Height));
		if (!isMouseMoved)
		{
			if (ToggleState == ToggleButtonState.ON)
			{
				ipadx = contentRectangle.Right - (contentRectangle.Height - 3);
			}
			else
			{
				ipadx = 2;
			}
		}
		Rectangle rect = new Rectangle(ipadx, rectangle.Y, rectangle.Height - 5, rectangle.Height);
		new Rectangle(base.Width / 6 - 10, base.Height / 2, base.Width / 6 - 10 + (rect.X + rect.Width / 2), base.Height / 2);
		GraphicsPath graphicsPath = new GraphicsPath();
		int num = base.Height;
		graphicsPath.AddArc(rectangle.X, rectangle.Y, num, num, 180f, 90f);
		graphicsPath.AddArc(rectangle.X + rectangle.Width - num, rectangle.Y, num, num, 270f, 90f);
		graphicsPath.AddArc(rectangle.X + rectangle.Width - num, rectangle.Y + rectangle.Height - num, num, num, 0f, 90f);
		graphicsPath.AddArc(rectangle.X, rectangle.Y + rectangle.Height - num, num, num, 90f, 90f);
		base.Region = new Region(graphicsPath);
		if (ipadx < contentRectangle.Width / 2)
		{
			iosSelected = false;
		}
		else if (ipadx == contentRectangle.Right - (contentRectangle.Height - 3) || ipadx > contentRectangle.Width / 2)
		{
			iosSelected = true;
		}
		Rectangle rect2 = new Rectangle(rectangle.X, rectangle.Y, rectangle.X + rect.Right, rectangle.Height);
		Rectangle rect3 = new Rectangle(rect.X + rect.Width / 2, rectangle.Y, rect.X + rect.Width / 2 + rectangle.Right, rectangle.Height);
		SolidBrush brush = new SolidBrush(ActiveColor);
		e.Graphics.FillRectangle(brush, rect2);
		brush = new SolidBrush(InActiveColor);
		e.Graphics.FillRectangle(brush, rect3);
		if (iosSelected)
		{
			e.Graphics.DrawString(ActiveText, Font, new SolidBrush(TextColor), new PointF(contentRectangle.X + 8, contentRectangle.Y + contentRectangle.Height / 4));
		}
		else
		{
			e.Graphics.DrawString(InActiveText, Font, new SolidBrush(TextColor), new PointF(rect.Right + 5, contentRectangle.Y + contentRectangle.Height / 4));
		}
		Color color = ((base.Parent != null) ? base.Parent.BackColor : Color.White);
		SolidBrush solidBrush = new SolidBrush(InActiveColor);
		if (ToggleState == ToggleButtonState.ON)
		{
			solidBrush.Color = ActiveColor;
		}
		e.Graphics.DrawEllipse(new Pen(solidBrush.Color), rect);
		e.Graphics.FillEllipse(solidBrush, rect);
		e.Graphics.DrawPath(new Pen(color, 2f), graphicsPath);
		if (!base.DesignMode)
		{
			Image image = Image.FromFile(f.FullName);
			e.Graphics.DrawImage(image, rect);
		}
	}

	private void DrawCustomStyle(PaintEventArgs e)
	{
		BackColor = Color.FromArgb(43, 43, 45);
		e.Graphics.SmoothingMode = SmoothingMode.HighQuality;
		e.Graphics.PixelOffsetMode = PixelOffsetMode.HighQuality;
		Rectangle rectangle = (contentRectangle = new Rectangle(0, 0, base.Width, base.Height));
		GraphicsPath graphicsPath = new GraphicsPath();
		int num = base.Height;
		graphicsPath.AddArc(rectangle.X, rectangle.Y, num, num, 180f, 90f);
		graphicsPath.AddArc(rectangle.X + rectangle.Width - num, rectangle.Y, num, num, 270f, 90f);
		graphicsPath.AddArc(rectangle.X + rectangle.Width - num, rectangle.Y + rectangle.Height - num, num, num, 0f, 90f);
		graphicsPath.AddArc(rectangle.X, rectangle.Y + rectangle.Height - num, num, num, 90f, 90f);
		base.Region = new Region(graphicsPath);
		Color color = ((base.Parent != null) ? base.Parent.BackColor : Color.White);
		e.Graphics.DrawPath(new Pen(color, 2f), graphicsPath);
		Point point = new Point(rectangle.Width / 4, rectangle.Y);
		Point point2 = new Point(rectangle.X + (rectangle.Width / 4 + rectangle.Width / 2), rectangle.Y);
		Rectangle rectangle2 = new Rectangle(point.X, base.Height / 2 - rectangle.Height / 8, point2.X - point.X, rectangle.Height / 6);
		GraphicsPath graphicsPath2 = new GraphicsPath();
		num = base.Height / 6;
		graphicsPath2.AddArc(rectangle2.X, rectangle2.Y, num, num, 180f, 90f);
		graphicsPath2.AddArc(rectangle2.X + rectangle2.Width - num, rectangle2.Y, num, num, 270f, 90f);
		graphicsPath2.AddArc(rectangle2.X + rectangle2.Width - num, rectangle2.Y + rectangle2.Height - num, num, num, 0f, 90f);
		graphicsPath2.AddArc(rectangle2.X, rectangle2.Y + rectangle2.Height - num, num, num, 90f, 90f);
		RectangleF bounds = graphicsPath2.GetBounds();
		staticInnerRect = new RectangleF(bounds.X, bounds.Y, bounds.Width, bounds.Height);
		if (!isMouseMoved)
		{
			if (ToggleState == ToggleButtonState.ON)
			{
				tPadx = (int)staticInnerRect.Right - 20;
			}
			else
			{
				tPadx = (int)staticInnerRect.X;
			}
		}
		custInnerRect = new RectangleF(tPadx, bounds.Y, bounds.Width, bounds.Height);
		e.Graphics.DrawPath(new Pen(Color.FromArgb(64, 64, 64), 2f), graphicsPath2);
		using (LinearGradientBrush brush = new LinearGradientBrush(graphicsPath2.GetBounds(), Color.FromArgb(19, 19, 19), Color.FromArgb(64, 64, 64), LinearGradientMode.Vertical))
		{
			e.Graphics.FillPath(brush, graphicsPath2);
			e.Graphics.DrawString(InActiveText, Font, Brushes.Gray, new Point(rectangle.X + 10, (int)graphicsPath2.GetBounds().Y));
			e.Graphics.DrawString(ActiveText, Font, Brushes.Gray, new Point((int)graphicsPath2.GetBounds().Right + 10, (int)graphicsPath2.GetBounds().Y));
		}
		Point point3 = new Point((int)custInnerRect.X + 12, (int)bounds.Y - 9);
		Point point4 = new Point((int)custInnerRect.X - 2, (int)bounds.Y);
		Point point5 = new Point((int)custInnerRect.X + 3, (int)bounds.Bottom + 7);
		Point point6 = new Point((int)custInnerRect.X + 20, (int)bounds.Bottom + 7);
		Point point7 = new Point((int)custInnerRect.X + 24, (int)bounds.Y);
		Point[] points = new Point[5] { point3, point4, point5, point6, point7 };
		e.Graphics.DrawPolygon(Pens.Black, points);
		using (LinearGradientBrush brush2 = new LinearGradientBrush(point3, point5, Color.Gray, Color.Black))
		{
			e.Graphics.FillPolygon(brush2, points);
		}
		int num2 = point5.X + (point6.X - point5.X) / 4;
		if (ToggleState == ToggleButtonState.OFF)
		{
			e.Graphics.FillEllipse(new SolidBrush(InActiveColor), num2, point4.Y, 10, 10);
		}
		else
		{
			e.Graphics.FillEllipse(new SolidBrush(ActiveColor), num2, point4.Y, 10, 10);
		}
	}

	private Point[] GetPolygonPoints(Rectangle r)
	{
		Point point = new Point(ipadx, r.Y + r.Height / 3);
		Point point2 = new Point(point.X + 40, r.Y);
		Point point3 = new Point(point.X + 20, r.Bottom);
		Point point4 = new Point(point3.X + 40, r.Height - r.Height / 3);
		return new Point[4] { point, point2, point4, point3 };
	}

	protected void RaiseButtonStateChanged()
	{
		if (this.ButtonStateChanged != null)
		{
			this.ButtonStateChanged(this, new ToggleButtonStateEventArgs(ToggleState));
		}
	}

	protected override void OnClick(EventArgs e)
	{
		base.OnClick(e);
		sliderPoint = downpos;
		dblclick = !dblclick;
		switchrec = !switchrec;
		if (ToggleStyle == ToggleButtonStyle.Windows)
		{
			if (WindowSliderBounds.X < controlBounds.Width / 2)
			{
				sliderPoint = new Point(controlBounds.Left, sliderPoint.Y);
				ToggleState = ToggleButtonState.OFF;
			}
			else
			{
				sliderPoint = new Point(controlBounds.Right - 15, sliderPoint.Y);
				ToggleState = ToggleButtonState.ON;
			}
		}
		else if (ToggleStyle == ToggleButtonStyle.Android)
		{
			if (downpos.X <= contentRectangle.Width / 4)
			{
				padx = contentRectangle.Left;
				ToggleState = ToggleButtonState.OFF;
			}
			else
			{
				padx = contentRectangle.Right - contentRectangle.Width / 2;
				ToggleState = ToggleButtonState.ON;
			}
		}
		else if (ToggleStyle == ToggleButtonStyle.IOS || ToggleStyle == ToggleButtonStyle.Metallic)
		{
			if (downpos.X <= contentRectangle.Width / 4)
			{
				ipadx = 2;
				ToggleState = ToggleButtonState.OFF;
			}
			else
			{
				ipadx = (ipadx = contentRectangle.Right - (contentRectangle.Height - 3));
				ToggleState = ToggleButtonState.ON;
			}
		}
		else if (ToggleStyle == ToggleButtonStyle.Custom)
		{
			tPadx = downpos.X;
			if ((float)tPadx <= staticInnerRect.X + staticInnerRect.Width / 2f)
			{
				tPadx = (int)staticInnerRect.X;
				ToggleState = ToggleButtonState.OFF;
			}
			else if ((float)tPadx >= staticInnerRect.X + staticInnerRect.Width / 2f)
			{
				tPadx = (int)staticInnerRect.Right - 20;
				ToggleState = ToggleButtonState.ON;
			}
		}
		Refresh();
	}

	private Rectangle GetRectangle()
	{
		return new Rectangle(2, 2, base.Width - 5, base.Height - 5);
	}

	protected override void OnMouseDown(MouseEventArgs e)
	{
		base.OnMouseDown(e);
		if (!base.DesignMode)
		{
			isMouseDown = true;
			downpos = e.Location;
		}
		Invalidate();
	}

	protected override void OnKeyDown(KeyEventArgs e)
	{
		base.OnKeyDown(e);
		if (e.KeyCode == Keys.Space)
		{
			if (ToggleState == ToggleButtonState.ON)
			{
				ToggleState = ToggleButtonState.OFF;
			}
			else
			{
				ToggleState = ToggleButtonState.ON;
			}
		}
	}

	protected override void OnMouseMove(MouseEventArgs e)
	{
		base.OnMouseMove(e);
		if (e.Button != MouseButtons.Left || base.DesignMode)
		{
			return;
		}
		sliderPoint = e.Location;
		isMouseMoved = true;
		if (ToggleStyle == ToggleButtonStyle.Android)
		{
			padx = e.X;
			if (padx <= contentRectangle.Left + SlidingAngle)
			{
				padx = contentRectangle.Left;
				ToggleState = ToggleButtonState.OFF;
			}
			if (padx >= contentRectangle.Right - contentRectangle.Width / 2)
			{
				padx = contentRectangle.Right - contentRectangle.Width / 2;
				ToggleState = ToggleButtonState.ON;
			}
		}
		else if (ToggleStyle == ToggleButtonStyle.IOS || ToggleStyle == ToggleButtonStyle.Metallic)
		{
			ipadx = e.X;
			if (ipadx <= 2)
			{
				ipadx = 2;
				ToggleState = ToggleButtonState.OFF;
			}
			if (ipadx >= contentRectangle.Right - (contentRectangle.Height - 3))
			{
				ipadx = contentRectangle.Right - (contentRectangle.Height - 3);
				ToggleState = ToggleButtonState.ON;
			}
		}
		else if (ToggleStyle == ToggleButtonStyle.Custom)
		{
			tPadx = e.X;
			if ((float)tPadx <= staticInnerRect.X)
			{
				tPadx = (int)staticInnerRect.X;
				ToggleState = ToggleButtonState.OFF;
			}
			if ((float)tPadx >= staticInnerRect.Right - 20f)
			{
				tPadx = (int)staticInnerRect.Right - 20;
				ToggleState = ToggleButtonState.ON;
			}
		}
		Refresh();
	}

	protected override void OnMouseUp(MouseEventArgs e)
	{
		base.OnMouseUp(e);
		if (base.DesignMode)
		{
			return;
		}
		Invalidate();
		if (isMouseMoved)
		{
			if (ToggleStyle == ToggleButtonStyle.Windows)
			{
				sliderPoint = e.Location;
				if (WindowSliderBounds.X < controlBounds.Width / 2)
				{
					sliderPoint = new Point(controlBounds.Left, sliderPoint.Y);
					ToggleState = ToggleButtonState.OFF;
				}
				else
				{
					sliderPoint = new Point(controlBounds.Right - 15, sliderPoint.Y);
					ToggleState = ToggleButtonState.ON;
				}
			}
			else if (ToggleStyle == ToggleButtonStyle.Android)
			{
				padx = e.Location.X;
				if (padx < contentRectangle.Width / 4)
				{
					padx = contentRectangle.Left;
					ToggleState = ToggleButtonState.OFF;
				}
				else
				{
					padx = contentRectangle.Right - contentRectangle.Width / 2;
					ToggleState = ToggleButtonState.ON;
				}
			}
			else if (ToggleStyle == ToggleButtonStyle.IOS || ToggleStyle == ToggleButtonStyle.Metallic)
			{
				ipadx = e.Location.X;
				if (ipadx < contentRectangle.Width / 2)
				{
					ipadx = 2;
					ToggleState = ToggleButtonState.OFF;
				}
				else
				{
					ipadx = contentRectangle.Right - (contentRectangle.Height - 3);
					ToggleState = ToggleButtonState.ON;
				}
			}
			else if (ToggleStyle == ToggleButtonStyle.Custom)
			{
				tPadx = e.Location.X;
				if ((float)tPadx <= staticInnerRect.X + staticInnerRect.Width / 2f)
				{
					tPadx = (int)staticInnerRect.X;
					ToggleState = ToggleButtonState.OFF;
				}
				else if ((float)tPadx >= staticInnerRect.X + staticInnerRect.Width / 2f)
				{
					tPadx = (int)staticInnerRect.Right - 20;
					ToggleState = ToggleButtonState.ON;
				}
			}
			Invalidate();
			Update();
		}
		isMouseMoved = false;
		isMouseDown = false;
	}

	private void RefreshToggleState(ToggleButtonState state)
	{
		ToggleState = state;
		justRefresh = true;
	}

	public static FileInfo FindApplicationFile(string fileName)
	{
		FileInfo fileInfo = new FileInfo(Path.Combine(Application.StartupPath, fileName));
		while (!fileInfo.Exists)
		{
			if (fileInfo.Directory.Parent == null)
			{
				return null;
			}
			fileInfo = new FileInfo(Path.Combine(fileInfo.Directory.Parent.FullName, fileInfo.Name));
		}
		return fileInfo;
	}
}
