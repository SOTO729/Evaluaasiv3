using System;
using System.ComponentModel;
using System.Drawing;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Windows.Forms;
using CulturaDigital.Helpers;
using CulturaDigital.Properties;

namespace CulturaDigital.Forms;

public class Help : Form
{
	private string appPath = Path.GetDirectoryName(Assembly.GetEntryAssembly().Location);

	private const int WM_SYSCOMMAND = 274;

	private const int MOUSE_MOVE = 61458;

	private IContainer components;

	private Panel pnlTitle;

	private Button button1;

	private Panel pnlRadio;

	private Panel pnlOrdenar;

	private Panel panel7;

	private Panel pnlArrastrar;

	private Panel panel5;

	private Panel pnlTF;

	private Panel pnlCheck;

	public Label lblDetalle;

	public Label lblTitulo;

	public Help()
	{
		InitializeComponent();
		pnlTitle.MouseMove += Form1_MouseMove;
		lblTitulo.MouseMove += Form1_MouseMove;
	}

	private void pbImagenEjemplo_Click(object sender, EventArgs e)
	{
	}

	private void button1_Click(object sender, EventArgs e)
	{
		Close();
	}

	[DllImport("user32.DLL")]
	private static extern void ReleaseCapture();

	[DllImport("user32.DLL")]
	private static extern void SendMessage(IntPtr hWnd, int wMsg, int wParam, int lParam);

	private void moverForm()
	{
		ReleaseCapture();
		SendMessage(base.Handle, 274, 61458, 0);
	}

	private void Form1_MouseMove(object sender, MouseEventArgs e)
	{
		moverForm();
	}

	private void Help_Load(object sender, EventArgs e)
	{
		try
		{
			if (File.Exists(Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/fondo.png")))
			{
				lblDetalle.ForeColor = Color.White;
				BackgroundImage = Image.FromFile(Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/fondo.png"));
			}
			if (File.Exists(Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/fondo.png")))
			{
				pnlTitle.BackgroundImage = Image.FromFile(Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/fondo.png"));
			}
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
		System.ComponentModel.ComponentResourceManager resources = new System.ComponentModel.ComponentResourceManager(typeof(CulturaDigital.Forms.Help));
		this.pnlTitle = new System.Windows.Forms.Panel();
		this.panel7 = new System.Windows.Forms.Panel();
		this.button1 = new System.Windows.Forms.Button();
		this.lblTitulo = new System.Windows.Forms.Label();
		this.pnlRadio = new System.Windows.Forms.Panel();
		this.lblDetalle = new System.Windows.Forms.Label();
		this.pnlOrdenar = new System.Windows.Forms.Panel();
		this.pnlArrastrar = new System.Windows.Forms.Panel();
		this.panel5 = new System.Windows.Forms.Panel();
		this.pnlTF = new System.Windows.Forms.Panel();
		this.pnlCheck = new System.Windows.Forms.Panel();
		this.pnlTitle.SuspendLayout();
		this.pnlRadio.SuspendLayout();
		base.SuspendLayout();
		this.pnlTitle.BackColor = System.Drawing.Color.FromArgb(0, 52, 106);
		this.pnlTitle.Controls.Add(this.panel7);
		this.pnlTitle.Controls.Add(this.button1);
		this.pnlTitle.Controls.Add(this.lblTitulo);
		this.pnlTitle.Dock = System.Windows.Forms.DockStyle.Top;
		this.pnlTitle.Location = new System.Drawing.Point(0, 0);
		this.pnlTitle.Name = "pnlTitle";
		this.pnlTitle.Size = new System.Drawing.Size(600, 47);
		this.pnlTitle.TabIndex = 2;
		this.panel7.Location = new System.Drawing.Point(12, 52);
		this.panel7.Name = "panel7";
		this.panel7.Size = new System.Drawing.Size(200, 100);
		this.panel7.TabIndex = 5;
		this.button1.Anchor = System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Right;
		this.button1.BackColor = System.Drawing.Color.Red;
		this.button1.BackgroundImage = CulturaDigital.Properties.Resources.btn_cerrar_reposo;
		this.button1.BackgroundImageLayout = System.Windows.Forms.ImageLayout.Stretch;
		this.button1.FlatAppearance.BorderColor = System.Drawing.Color.White;
		this.button1.FlatAppearance.BorderSize = 0;
		this.button1.FlatStyle = System.Windows.Forms.FlatStyle.Flat;
		this.button1.Location = new System.Drawing.Point(550, 0);
		this.button1.Name = "button1";
		this.button1.Size = new System.Drawing.Size(50, 34);
		this.button1.TabIndex = 2;
		this.button1.UseVisualStyleBackColor = false;
		this.button1.Click += new System.EventHandler(button1_Click);
		this.lblTitulo.BackColor = System.Drawing.Color.Transparent;
		this.lblTitulo.Font = new System.Drawing.Font("Segoe UI", 12f, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, 0);
		this.lblTitulo.ForeColor = System.Drawing.Color.White;
		this.lblTitulo.Location = new System.Drawing.Point(3, 12);
		this.lblTitulo.Name = "lblTitulo";
		this.lblTitulo.Size = new System.Drawing.Size(597, 21);
		this.lblTitulo.TabIndex = 25;
		this.lblTitulo.Text = "Opción múltiple";
		this.lblTitulo.TextAlign = System.Drawing.ContentAlignment.TopCenter;
		this.pnlRadio.BackColor = System.Drawing.Color.Transparent;
		this.pnlRadio.Controls.Add(this.lblDetalle);
		this.pnlRadio.Dock = System.Windows.Forms.DockStyle.Fill;
		this.pnlRadio.Location = new System.Drawing.Point(0, 47);
		this.pnlRadio.Name = "pnlRadio";
		this.pnlRadio.Size = new System.Drawing.Size(600, 203);
		this.pnlRadio.TabIndex = 3;
		this.lblDetalle.BackColor = System.Drawing.Color.Transparent;
		this.lblDetalle.Font = new System.Drawing.Font("Segoe UI", 12f, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, 0);
		this.lblDetalle.ForeColor = System.Drawing.Color.FromArgb(12, 89, 135);
		this.lblDetalle.Location = new System.Drawing.Point(4, 7);
		this.lblDetalle.Name = "lblDetalle";
		this.lblDetalle.Size = new System.Drawing.Size(591, 189);
		this.lblDetalle.TabIndex = 23;
		this.lblDetalle.Text = "Deberás elegir la opción correcta. (solo UNA)";
		this.pnlOrdenar.Dock = System.Windows.Forms.DockStyle.Fill;
		this.pnlOrdenar.Location = new System.Drawing.Point(0, 0);
		this.pnlOrdenar.Name = "pnlOrdenar";
		this.pnlOrdenar.Size = new System.Drawing.Size(600, 250);
		this.pnlOrdenar.TabIndex = 4;
		this.pnlArrastrar.Dock = System.Windows.Forms.DockStyle.Fill;
		this.pnlArrastrar.Location = new System.Drawing.Point(0, 0);
		this.pnlArrastrar.Name = "pnlArrastrar";
		this.pnlArrastrar.Size = new System.Drawing.Size(600, 250);
		this.pnlArrastrar.TabIndex = 5;
		this.panel5.Dock = System.Windows.Forms.DockStyle.Fill;
		this.panel5.Location = new System.Drawing.Point(0, 0);
		this.panel5.Name = "panel5";
		this.panel5.Size = new System.Drawing.Size(600, 250);
		this.panel5.TabIndex = 6;
		this.pnlTF.Dock = System.Windows.Forms.DockStyle.Fill;
		this.pnlTF.Location = new System.Drawing.Point(0, 0);
		this.pnlTF.Name = "pnlTF";
		this.pnlTF.Size = new System.Drawing.Size(600, 250);
		this.pnlTF.TabIndex = 7;
		this.pnlCheck.Dock = System.Windows.Forms.DockStyle.Fill;
		this.pnlCheck.Location = new System.Drawing.Point(0, 0);
		this.pnlCheck.Name = "pnlCheck";
		this.pnlCheck.Size = new System.Drawing.Size(600, 250);
		this.pnlCheck.TabIndex = 8;
		base.AutoScaleDimensions = new System.Drawing.SizeF(6f, 13f);
		base.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
		this.BackColor = System.Drawing.Color.White;
		this.BackgroundImageLayout = System.Windows.Forms.ImageLayout.Stretch;
		base.ClientSize = new System.Drawing.Size(600, 250);
		base.Controls.Add(this.pnlRadio);
		base.Controls.Add(this.pnlTitle);
		base.Controls.Add(this.pnlCheck);
		base.Controls.Add(this.pnlTF);
		base.Controls.Add(this.panel5);
		base.Controls.Add(this.pnlArrastrar);
		base.Controls.Add(this.pnlOrdenar);
		base.FormBorderStyle = System.Windows.Forms.FormBorderStyle.None;
		base.Icon = (System.Drawing.Icon)resources.GetObject("$this.Icon");
		base.Name = "Help";
		base.StartPosition = System.Windows.Forms.FormStartPosition.CenterParent;
		this.Text = "Help";
		base.Load += new System.EventHandler(Help_Load);
		this.pnlTitle.ResumeLayout(false);
		this.pnlRadio.ResumeLayout(false);
		base.ResumeLayout(false);
	}
}
