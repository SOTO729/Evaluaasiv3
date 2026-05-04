using System;
using System.ComponentModel;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Reflection;
using System.Windows.Forms;
using CulturaDigital.Controls;
using CulturaDigital.Helpers;
using CulturaDigital.Properties;

namespace CulturaDigital.Forms;

public class CulturaDigital_Finalizar : Form
{
	private string appPath = Path.GetDirectoryName(Assembly.GetEntryAssembly().Location);

	private IContainer components;

	private Panel pnlTitle;

	private Button btnClose;

	public TrackBar trackBar1;

	private Button btnConstancia;

	private Button button2;

	private Label label1;

	public Label lblVersion;

	public Label lblVoucher;

	private PictureBox pbtitulo;

	private Panel PnlDragDropPanels;

	public ImagePanel imagePanel1;

	public string Ruta { get; set; }

	public CulturaDigital_Finalizar()
	{
		InitializeComponent();
	}

	private void trackBar1_Scroll(object sender, EventArgs e)
	{
		imagePanel1.Zoom = (float)trackBar1.Value * 0.02f;
	}

	private void btnConstancia_Click(object sender, EventArgs e)
	{
		Process.Start(Ruta + "\\Constancias\\");
	}

	private void button2_Click(object sender, EventArgs e)
	{
		Process.Start(Ruta + "\\Resultados\\");
	}

	private void btnClose_Click(object sender, EventArgs e)
	{
		base.DialogResult = DialogResult.Abort;
		Close();
	}

	private void Finalizar_Load(object sender, EventArgs e)
	{
		imagePanel1.Focus();
		try
		{
			if (File.Exists(Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/fondo_preguntas.png")))
			{
				PnlDragDropPanels.BackgroundImage = Image.FromFile(Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/fondo_preguntas.png"));
			}
			if (File.Exists(Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/pleca_superior.png")))
			{
				pnlTitle.BackgroundImage = Image.FromFile(Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/pleca_superior.png"));
			}
			if (File.Exists(Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/titulo_examen.png")))
			{
				pbtitulo.BackgroundImage = Image.FromFile(Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/titulo_examen.png"));
			}
			if (File.Exists(Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/indicaciones_examen.png")))
			{
				BackgroundImage = Image.FromFile(Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/fondo.png"));
			}
		}
		catch (Exception)
		{
		}
	}

	private void imagePanel1_Scroll(object sender, ScrollEventArgs e)
	{
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
		System.ComponentModel.ComponentResourceManager resources = new System.ComponentModel.ComponentResourceManager(typeof(CulturaDigital.Forms.CulturaDigital_Finalizar));
		this.pnlTitle = new System.Windows.Forms.Panel();
		this.lblVersion = new System.Windows.Forms.Label();
		this.lblVoucher = new System.Windows.Forms.Label();
		this.btnClose = new System.Windows.Forms.Button();
		this.pbtitulo = new System.Windows.Forms.PictureBox();
		this.trackBar1 = new System.Windows.Forms.TrackBar();
		this.btnConstancia = new System.Windows.Forms.Button();
		this.button2 = new System.Windows.Forms.Button();
		this.label1 = new System.Windows.Forms.Label();
		this.PnlDragDropPanels = new System.Windows.Forms.Panel();
		this.imagePanel1 = new CulturaDigital.Controls.ImagePanel();
		this.pnlTitle.SuspendLayout();
		((System.ComponentModel.ISupportInitialize)this.pbtitulo).BeginInit();
		((System.ComponentModel.ISupportInitialize)this.trackBar1).BeginInit();
		this.PnlDragDropPanels.SuspendLayout();
		base.SuspendLayout();
		this.pnlTitle.BackColor = System.Drawing.Color.Transparent;
		this.pnlTitle.Controls.Add(this.lblVersion);
		this.pnlTitle.Controls.Add(this.lblVoucher);
		this.pnlTitle.Controls.Add(this.btnClose);
		this.pnlTitle.Controls.Add(this.pbtitulo);
		this.pnlTitle.Dock = System.Windows.Forms.DockStyle.Top;
		this.pnlTitle.Location = new System.Drawing.Point(0, 0);
		this.pnlTitle.Name = "pnlTitle";
		this.pnlTitle.Size = new System.Drawing.Size(1024, 79);
		this.pnlTitle.TabIndex = 5;
		this.lblVersion.Anchor = System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Left;
		this.lblVersion.AutoSize = true;
		this.lblVersion.BackColor = System.Drawing.Color.Transparent;
		this.lblVersion.Font = new System.Drawing.Font("Segoe UI", 14.25f);
		this.lblVersion.ForeColor = System.Drawing.Color.White;
		this.lblVersion.Location = new System.Drawing.Point(3, 39);
		this.lblVersion.Name = "lblVersion";
		this.lblVersion.Size = new System.Drawing.Size(63, 25);
		this.lblVersion.TabIndex = 11;
		this.lblVersion.Text = "label4";
		this.lblVoucher.Anchor = System.Windows.Forms.AnchorStyles.Right;
		this.lblVoucher.Font = new System.Drawing.Font("Segoe UI", 14.25f, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, 0);
		this.lblVoucher.ForeColor = System.Drawing.Color.White;
		this.lblVoucher.Location = new System.Drawing.Point(730, 39);
		this.lblVoucher.Name = "lblVoucher";
		this.lblVoucher.Size = new System.Drawing.Size(293, 25);
		this.lblVoucher.TabIndex = 10;
		this.lblVoucher.Text = "Voucher: XXXX-XXXX-XXXX-XXXX";
		this.lblVoucher.TextAlign = System.Drawing.ContentAlignment.TopCenter;
		this.lblVoucher.Visible = false;
		this.btnClose.Anchor = System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Right;
		this.btnClose.BackColor = System.Drawing.Color.Red;
		this.btnClose.BackgroundImage = CulturaDigital.Properties.Resources.btn_cerrar_reposo;
		this.btnClose.BackgroundImageLayout = System.Windows.Forms.ImageLayout.Stretch;
		this.btnClose.FlatAppearance.BorderSize = 0;
		this.btnClose.FlatAppearance.CheckedBackColor = System.Drawing.Color.FromArgb(227, 22, 51);
		this.btnClose.FlatAppearance.MouseDownBackColor = System.Drawing.Color.FromArgb(227, 22, 51);
		this.btnClose.FlatAppearance.MouseOverBackColor = System.Drawing.Color.FromArgb(227, 22, 51);
		this.btnClose.FlatStyle = System.Windows.Forms.FlatStyle.Flat;
		this.btnClose.Location = new System.Drawing.Point(974, 0);
		this.btnClose.Name = "btnClose";
		this.btnClose.Size = new System.Drawing.Size(50, 34);
		this.btnClose.TabIndex = 1;
		this.btnClose.UseVisualStyleBackColor = false;
		this.btnClose.Click += new System.EventHandler(btnClose_Click);
		this.pbtitulo.Anchor = System.Windows.Forms.AnchorStyles.Left | System.Windows.Forms.AnchorStyles.Right;
		this.pbtitulo.BackgroundImageLayout = System.Windows.Forms.ImageLayout.Center;
		this.pbtitulo.Location = new System.Drawing.Point(0, 0);
		this.pbtitulo.Name = "pbtitulo";
		this.pbtitulo.Size = new System.Drawing.Size(1025, 69);
		this.pbtitulo.TabIndex = 20;
		this.pbtitulo.TabStop = false;
		this.trackBar1.Anchor = System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Left | System.Windows.Forms.AnchorStyles.Right;
		this.trackBar1.BackColor = System.Drawing.Color.FromArgb(224, 224, 224);
		this.trackBar1.Location = new System.Drawing.Point(270, 717);
		this.trackBar1.Maximum = 30;
		this.trackBar1.Minimum = 10;
		this.trackBar1.Name = "trackBar1";
		this.trackBar1.Size = new System.Drawing.Size(487, 45);
		this.trackBar1.TabIndex = 1;
		this.trackBar1.TickFrequency = 10;
		this.trackBar1.Value = 10;
		this.trackBar1.Scroll += new System.EventHandler(trackBar1_Scroll);
		this.btnConstancia.Anchor = System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Left;
		this.btnConstancia.BackColor = System.Drawing.Color.Transparent;
		this.btnConstancia.FlatAppearance.BorderColor = System.Drawing.Color.White;
		this.btnConstancia.FlatAppearance.BorderSize = 2;
		this.btnConstancia.FlatAppearance.MouseDownBackColor = System.Drawing.Color.FromArgb(255, 109, 14);
		this.btnConstancia.FlatAppearance.MouseOverBackColor = System.Drawing.Color.FromArgb(254, 185, 20);
		this.btnConstancia.FlatStyle = System.Windows.Forms.FlatStyle.Flat;
		this.btnConstancia.Font = new System.Drawing.Font("Segoe UI", 9.75f, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, 0);
		this.btnConstancia.ForeColor = System.Drawing.Color.White;
		this.btnConstancia.Location = new System.Drawing.Point(53, 717);
		this.btnConstancia.Name = "btnConstancia";
		this.btnConstancia.Size = new System.Drawing.Size(95, 29);
		this.btnConstancia.TabIndex = 7;
		this.btnConstancia.Text = "Constancias";
		this.btnConstancia.UseVisualStyleBackColor = false;
		this.btnConstancia.Click += new System.EventHandler(btnConstancia_Click);
		this.button2.Anchor = System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Left;
		this.button2.BackColor = System.Drawing.Color.Transparent;
		this.button2.FlatAppearance.BorderColor = System.Drawing.Color.White;
		this.button2.FlatAppearance.BorderSize = 2;
		this.button2.FlatAppearance.MouseDownBackColor = System.Drawing.Color.FromArgb(17, 113, 174);
		this.button2.FlatAppearance.MouseOverBackColor = System.Drawing.Color.FromArgb(21, 163, 239);
		this.button2.FlatStyle = System.Windows.Forms.FlatStyle.Flat;
		this.button2.Font = new System.Drawing.Font("Segoe UI", 9.75f, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, 0);
		this.button2.ForeColor = System.Drawing.Color.White;
		this.button2.Location = new System.Drawing.Point(154, 717);
		this.button2.Name = "button2";
		this.button2.Size = new System.Drawing.Size(95, 29);
		this.button2.TabIndex = 7;
		this.button2.Text = "Resultados";
		this.button2.UseVisualStyleBackColor = false;
		this.button2.Click += new System.EventHandler(button2_Click);
		this.label1.Anchor = System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Left | System.Windows.Forms.AnchorStyles.Right;
		this.label1.BackColor = System.Drawing.Color.Transparent;
		this.label1.Font = new System.Drawing.Font("Segoe UI", 9.75f, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, 0);
		this.label1.ForeColor = System.Drawing.Color.White;
		this.label1.Location = new System.Drawing.Point(182, 749);
		this.label1.Name = "label1";
		this.label1.Size = new System.Drawing.Size(662, 20);
		this.label1.TabIndex = 8;
		this.label1.Text = "Utiliza el control deslizable para aumentar o reducir el zoom a la imagen";
		this.label1.TextAlign = System.Drawing.ContentAlignment.TopCenter;
		this.PnlDragDropPanels.Anchor = System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Left | System.Windows.Forms.AnchorStyles.Right;
		this.PnlDragDropPanels.BackColor = System.Drawing.Color.White;
		this.PnlDragDropPanels.BackgroundImageLayout = System.Windows.Forms.ImageLayout.Stretch;
		this.PnlDragDropPanels.Controls.Add(this.imagePanel1);
		this.PnlDragDropPanels.Location = new System.Drawing.Point(24, 85);
		this.PnlDragDropPanels.Name = "PnlDragDropPanels";
		this.PnlDragDropPanels.Size = new System.Drawing.Size(976, 626);
		this.PnlDragDropPanels.TabIndex = 11;
		this.imagePanel1.Anchor = System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Left | System.Windows.Forms.AnchorStyles.Right;
		this.imagePanel1.AutoScroll = true;
		this.imagePanel1.BackColor = System.Drawing.Color.Transparent;
		this.imagePanel1.BackgroundImageLayout = System.Windows.Forms.ImageLayout.Center;
		this.imagePanel1.CanvasSize = new System.Drawing.Size(60, 40);
		this.imagePanel1.Image = null;
		this.imagePanel1.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.Default;
		this.imagePanel1.Location = new System.Drawing.Point(246, 12);
		this.imagePanel1.Name = "imagePanel1";
		this.imagePanel1.Size = new System.Drawing.Size(487, 576);
		this.imagePanel1.TabIndex = 1;
		this.imagePanel1.Zoom = 1f;
		base.AutoScaleDimensions = new System.Drawing.SizeF(6f, 13f);
		base.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
		this.BackColor = System.Drawing.Color.FromArgb(0, 52, 106);
		base.ClientSize = new System.Drawing.Size(1024, 768);
		base.Controls.Add(this.button2);
		base.Controls.Add(this.btnConstancia);
		base.Controls.Add(this.label1);
		base.Controls.Add(this.trackBar1);
		base.Controls.Add(this.PnlDragDropPanels);
		base.Controls.Add(this.pnlTitle);
		base.FormBorderStyle = System.Windows.Forms.FormBorderStyle.None;
		base.Icon = (System.Drawing.Icon)resources.GetObject("$this.Icon");
		base.Name = "CulturaDigital_Finalizar";
		base.StartPosition = System.Windows.Forms.FormStartPosition.CenterScreen;
		this.Text = "Finalizar";
		base.WindowState = System.Windows.Forms.FormWindowState.Maximized;
		base.Load += new System.EventHandler(Finalizar_Load);
		this.pnlTitle.ResumeLayout(false);
		this.pnlTitle.PerformLayout();
		((System.ComponentModel.ISupportInitialize)this.pbtitulo).EndInit();
		((System.ComponentModel.ISupportInitialize)this.trackBar1).EndInit();
		this.PnlDragDropPanels.ResumeLayout(false);
		base.ResumeLayout(false);
		base.PerformLayout();
	}
}
