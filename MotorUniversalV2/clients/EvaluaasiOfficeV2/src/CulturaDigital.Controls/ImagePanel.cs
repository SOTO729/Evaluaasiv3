using System;
using System.ComponentModel;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Windows.Forms;

namespace CulturaDigital.Controls;

public class ImagePanel : UserControl
{
	private bool mAutoScroll = true;

	private int viewRectWidth;

	private int viewRectHeight;

	private float zoom = 1f;

	private Size canvasSize = new Size(60, 40);

	private Bitmap image;

	private InterpolationMode interMode = InterpolationMode.HighQualityBilinear;

	private IContainer components;

	private HScrollBar hScrollBar1;

	private VScrollBar vScrollBar1;

	public float Zoom
	{
		get
		{
			return zoom;
		}
		set
		{
			if (value < 0.001f)
			{
				value = 0.001f;
			}
			zoom = value;
			displayScrollbar();
			setScrollbarValues();
			Invalidate();
		}
	}

	public Size CanvasSize
	{
		get
		{
			return canvasSize;
		}
		set
		{
			canvasSize = value;
			displayScrollbar();
			setScrollbarValues();
			Invalidate();
		}
	}

	public Bitmap Image
	{
		get
		{
			return image;
		}
		set
		{
			image = value;
			displayScrollbar();
			setScrollbarValues();
			Invalidate();
		}
	}

	public InterpolationMode InterpolationMode
	{
		get
		{
			return interMode;
		}
		set
		{
			interMode = value;
		}
	}

	public ImagePanel()
	{
		InitializeComponent();
		SetStyle(ControlStyles.UserPaint | ControlStyles.ResizeRedraw | ControlStyles.AllPaintingInWmPaint | ControlStyles.DoubleBuffer, value: true);
	}

	protected override void OnLoad(EventArgs e)
	{
		displayScrollbar();
		setScrollbarValues();
		vScrollBar1.Focus();
		base.OnLoad(e);
	}

	protected override void OnResize(EventArgs e)
	{
		displayScrollbar();
		setScrollbarValues();
		vScrollBar1.Focus();
		base.OnResize(e);
	}

	protected override void OnPaint(PaintEventArgs e)
	{
		base.OnPaint(e);
		if (image != null)
		{
			Point location = new Point((int)((float)hScrollBar1.Value / zoom), (int)((float)vScrollBar1.Value / zoom));
			Rectangle srcRect = ((!((float)canvasSize.Width * zoom < (float)viewRectWidth) || !((float)canvasSize.Height * zoom < (float)viewRectHeight)) ? new Rectangle(location, new Size((int)((float)viewRectWidth / zoom), (int)((float)viewRectHeight / zoom))) : new Rectangle(0, 0, canvasSize.Width, canvasSize.Height));
			Rectangle destRect = new Rectangle(-srcRect.Width / 2, -srcRect.Height / 2, srcRect.Width, srcRect.Height);
			Matrix matrix = new Matrix();
			matrix.Scale(zoom, zoom);
			matrix.Translate((float)viewRectWidth / 2f, (float)viewRectHeight / 2f, MatrixOrder.Append);
			Graphics graphics = e.Graphics;
			graphics.InterpolationMode = interMode;
			graphics.Transform = matrix;
			graphics.DrawImage(image, destRect, srcRect, GraphicsUnit.Pixel);
		}
	}

	private void displayScrollbar()
	{
		viewRectWidth = base.Width;
		viewRectHeight = base.Height;
		if (image != null)
		{
			canvasSize = image.Size;
		}
		if ((float)viewRectWidth > (float)canvasSize.Width * zoom)
		{
			hScrollBar1.Visible = false;
			viewRectHeight = base.Height;
		}
		else
		{
			hScrollBar1.Visible = true;
			viewRectHeight = base.Height - hScrollBar1.Height;
		}
		if ((float)viewRectHeight > (float)canvasSize.Height * zoom)
		{
			vScrollBar1.Visible = false;
			viewRectWidth = base.Width;
		}
		else
		{
			vScrollBar1.Visible = true;
			viewRectWidth = base.Width - vScrollBar1.Width;
		}
		hScrollBar1.Location = new Point(0, base.Height - hScrollBar1.Height);
		hScrollBar1.Width = viewRectWidth;
		vScrollBar1.Location = new Point(base.Width - vScrollBar1.Width, 0);
		vScrollBar1.Height = viewRectHeight;
	}

	private void setScrollbarValues()
	{
		vScrollBar1.Minimum = 0;
		hScrollBar1.Minimum = 0;
		if ((float)canvasSize.Width * zoom - (float)viewRectWidth > 0f)
		{
			hScrollBar1.Maximum = (int)((float)canvasSize.Width * zoom) - viewRectWidth;
		}
		if (vScrollBar1.Visible)
		{
			hScrollBar1.Maximum += vScrollBar1.Width;
		}
		hScrollBar1.LargeChange = hScrollBar1.Maximum / 10;
		hScrollBar1.SmallChange = hScrollBar1.Maximum / 20;
		hScrollBar1.Maximum += hScrollBar1.LargeChange;
		if ((float)canvasSize.Height * zoom - (float)viewRectHeight > 0f)
		{
			vScrollBar1.Maximum = (int)((float)canvasSize.Height * zoom) - viewRectHeight;
		}
		if (hScrollBar1.Visible)
		{
			vScrollBar1.Maximum += hScrollBar1.Height;
		}
		vScrollBar1.LargeChange = vScrollBar1.Maximum / 10;
		vScrollBar1.SmallChange = vScrollBar1.Maximum / 20;
		vScrollBar1.Maximum += vScrollBar1.LargeChange;
	}

	private void ImagePanel_Load(object sender, EventArgs e)
	{
	}

	private void vScrollBar1_Scroll(object sender, ScrollEventArgs e)
	{
		Invalidate();
	}

	protected override void Dispose(bool disposing)
	{
		if (disposing && components != null)
		{
			components.Dispose();
		}
		base.Dispose(disposing);
	}

	private void InitializeComponent()
	{
		this.hScrollBar1 = new System.Windows.Forms.HScrollBar();
		this.vScrollBar1 = new System.Windows.Forms.VScrollBar();
		base.SuspendLayout();
		this.hScrollBar1.Location = new System.Drawing.Point(0, 133);
		this.hScrollBar1.Name = "hScrollBar1";
		this.hScrollBar1.Size = new System.Drawing.Size(80, 17);
		this.hScrollBar1.TabIndex = 0;
		this.hScrollBar1.Scroll += new System.Windows.Forms.ScrollEventHandler(vScrollBar1_Scroll);
		this.vScrollBar1.Location = new System.Drawing.Point(133, 0);
		this.vScrollBar1.Name = "vScrollBar1";
		this.vScrollBar1.Size = new System.Drawing.Size(17, 80);
		this.vScrollBar1.TabIndex = 1;
		this.vScrollBar1.Scroll += new System.Windows.Forms.ScrollEventHandler(vScrollBar1_Scroll);
		base.AutoScaleDimensions = new System.Drawing.SizeF(6f, 13f);
		base.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
		base.Controls.Add(this.vScrollBar1);
		base.Controls.Add(this.hScrollBar1);
		base.Name = "ImagePanel";
		base.Load += new System.EventHandler(ImagePanel_Load);
		base.ResumeLayout(false);
	}
}
