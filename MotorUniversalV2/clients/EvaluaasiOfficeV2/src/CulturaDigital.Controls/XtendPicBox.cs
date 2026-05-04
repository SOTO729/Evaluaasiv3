using System;
using System.ComponentModel;
using System.Drawing;
using System.Windows.Forms;

namespace CulturaDigital.Controls;

public class XtendPicBox : Panel
{
	public PictureBox innerPicture = new PictureBox();

	private string mPictureFile = string.Empty;

	private bool mAutoScroll = true;

	private Color _BackColor;

	private IContainer components;

	[Category("Image File")]
	[Browsable(true)]
	[Description("Set path to image file.")]
	public string PictureFile
	{
		get
		{
			return mPictureFile;
		}
		set
		{
			mPictureFile = value;
			if (!string.IsNullOrEmpty(mPictureFile))
			{
				innerPicture.Image = Image.FromFile(mPictureFile);
				innerPicture.Size = innerPicture.Image.Size;
				_BackColor = innerPicture.BackColor;
			}
		}
	}

	[Browsable(false)]
	public override bool AutoScroll
	{
		get
		{
			return mAutoScroll;
		}
		set
		{
			mAutoScroll = value;
		}
	}

	public XtendPicBox()
	{
		InitializeComponent();
		innerPicture.Top = 0;
		innerPicture.Left = 0;
		innerPicture.SizeMode = PictureBoxSizeMode.Zoom;
		base.Controls.Add(innerPicture);
	}

	public void CambiarZoom(float _ZoomFactor)
	{
		try
		{
			int num = (int)((float)innerPicture.Width / _ZoomFactor);
			int num2 = (int)((float)innerPicture.Height / _ZoomFactor);
			_ = num / 2;
			_ = num2 / 2;
			Bitmap image = new Bitmap(newSize: new Size((int)((float)innerPicture.Width * _ZoomFactor), (int)((float)innerPicture.Height * _ZoomFactor)), original: innerPicture.Image);
			innerPicture.Image = image;
			innerPicture.Refresh();
		}
		catch (Exception)
		{
		}
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
		this.components = new System.ComponentModel.Container();
	}
}
