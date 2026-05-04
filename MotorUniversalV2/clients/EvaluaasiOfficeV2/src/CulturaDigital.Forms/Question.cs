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

public class Question : Form
{
	private string appPath = Path.GetDirectoryName(Assembly.GetEntryAssembly().Location);

	private const int WM_SYSCOMMAND = 274;

	private const int MOUSE_MOVE = 61458;

	private IContainer components;

	private Panel pnlTitle;

	private Button button1;

	public Label lblTitulo;

	public Button btnNo;

	public Button btnSi;

	public Panel pnlFooter;

	private Panel panel1;

	public Label lblDetalle;

	public Question()
	{
		InitializeComponent();
		base.MouseMove += Form1_MouseMove;
		pnlTitle.MouseMove += Form1_MouseMove;
		lblTitulo.MouseMove += Form1_MouseMove;
	}

	private void btnSi_Click(object sender, EventArgs e)
	{
		base.DialogResult = DialogResult.OK;
		Close();
	}

	private void btnNo_Click(object sender, EventArgs e)
	{
		base.DialogResult = DialogResult.Abort;
		Close();
	}

	private void button1_Click(object sender, EventArgs e)
	{
		base.DialogResult = DialogResult.Cancel;
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

	private void Question_Load(object sender, EventArgs e)
	{
		try
		{
			if (File.Exists(Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/indicaciones_examen.png")))
			{
				lblDetalle.ForeColor = Color.White;
				pnlTitle.BackgroundImage = Image.FromFile(Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/indicaciones_examen.png"));
				pnlFooter.BackgroundImage = Image.FromFile(Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/indicaciones_examen.png"));
			}
			if (File.Exists(Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/fondo.png")))
			{
				BackgroundImage = Image.FromFile(Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/fondo.png"));
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
		System.ComponentModel.ComponentResourceManager resources = new System.ComponentModel.ComponentResourceManager(typeof(CulturaDigital.Forms.Question));
		this.pnlTitle = new System.Windows.Forms.Panel();
		this.button1 = new System.Windows.Forms.Button();
		this.lblTitulo = new System.Windows.Forms.Label();
		this.btnNo = new System.Windows.Forms.Button();
		this.btnSi = new System.Windows.Forms.Button();
		this.pnlFooter = new System.Windows.Forms.Panel();
		this.panel1 = new System.Windows.Forms.Panel();
		this.lblDetalle = new System.Windows.Forms.Label();
		this.pnlTitle.SuspendLayout();
		this.pnlFooter.SuspendLayout();
		this.panel1.SuspendLayout();
		base.SuspendLayout();
		this.pnlTitle.BackColor = System.Drawing.Color.FromArgb(0, 52, 106);
		this.pnlTitle.BackgroundImageLayout = System.Windows.Forms.ImageLayout.Stretch;
		this.pnlTitle.Controls.Add(this.button1);
		this.pnlTitle.Controls.Add(this.lblTitulo);
		this.pnlTitle.Dock = System.Windows.Forms.DockStyle.Top;
		this.pnlTitle.Location = new System.Drawing.Point(0, 0);
		this.pnlTitle.Name = "pnlTitle";
		this.pnlTitle.Size = new System.Drawing.Size(607, 63);
		this.pnlTitle.TabIndex = 3;
		this.button1.Anchor = System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Right;
		this.button1.BackColor = System.Drawing.Color.Red;
		this.button1.BackgroundImage = CulturaDigital.Properties.Resources.btn_cerrar_reposo;
		this.button1.BackgroundImageLayout = System.Windows.Forms.ImageLayout.Stretch;
		this.button1.FlatAppearance.BorderColor = System.Drawing.Color.White;
		this.button1.FlatAppearance.BorderSize = 0;
		this.button1.FlatStyle = System.Windows.Forms.FlatStyle.Flat;
		this.button1.Font = new System.Drawing.Font("Arial", 9.75f, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, 0);
		this.button1.ForeColor = System.Drawing.Color.White;
		this.button1.Location = new System.Drawing.Point(557, 0);
		this.button1.Name = "button1";
		this.button1.Size = new System.Drawing.Size(50, 34);
		this.button1.TabIndex = 2;
		this.button1.UseVisualStyleBackColor = false;
		this.button1.Click += new System.EventHandler(button1_Click);
		this.lblTitulo.BackColor = System.Drawing.Color.Transparent;
		this.lblTitulo.Font = new System.Drawing.Font("Segoe UI", 12f, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, 0);
		this.lblTitulo.ForeColor = System.Drawing.Color.White;
		this.lblTitulo.Location = new System.Drawing.Point(-3, 19);
		this.lblTitulo.Name = "lblTitulo";
		this.lblTitulo.Size = new System.Drawing.Size(607, 31);
		this.lblTitulo.TabIndex = 25;
		this.lblTitulo.Text = "Opción múltiple";
		this.lblTitulo.TextAlign = System.Drawing.ContentAlignment.MiddleCenter;
		this.btnNo.Anchor = System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Right;
		this.btnNo.BackColor = System.Drawing.Color.Transparent;
		this.btnNo.FlatAppearance.BorderColor = System.Drawing.Color.White;
		this.btnNo.FlatAppearance.BorderSize = 2;
		this.btnNo.FlatAppearance.MouseDownBackColor = System.Drawing.Color.FromArgb(255, 109, 14);
		this.btnNo.FlatAppearance.MouseOverBackColor = System.Drawing.Color.FromArgb(254, 185, 20);
		this.btnNo.FlatStyle = System.Windows.Forms.FlatStyle.Flat;
		this.btnNo.Font = new System.Drawing.Font("Segoe UI", 14.25f);
		this.btnNo.ForeColor = System.Drawing.Color.White;
		this.btnNo.Location = new System.Drawing.Point(8, 6);
		this.btnNo.Name = "btnNo";
		this.btnNo.Size = new System.Drawing.Size(106, 35);
		this.btnNo.TabIndex = 36;
		this.btnNo.Text = "No";
		this.btnNo.UseVisualStyleBackColor = false;
		this.btnNo.Click += new System.EventHandler(btnNo_Click);
		this.btnSi.Anchor = System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Right;
		this.btnSi.BackColor = System.Drawing.Color.Transparent;
		this.btnSi.FlatAppearance.BorderColor = System.Drawing.Color.White;
		this.btnSi.FlatAppearance.BorderSize = 2;
		this.btnSi.FlatAppearance.MouseDownBackColor = System.Drawing.Color.FromArgb(17, 113, 174);
		this.btnSi.FlatAppearance.MouseOverBackColor = System.Drawing.Color.FromArgb(21, 163, 239);
		this.btnSi.FlatStyle = System.Windows.Forms.FlatStyle.Flat;
		this.btnSi.Font = new System.Drawing.Font("Segoe UI", 14.25f);
		this.btnSi.ForeColor = System.Drawing.Color.White;
		this.btnSi.Location = new System.Drawing.Point(493, 7);
		this.btnSi.Name = "btnSi";
		this.btnSi.Size = new System.Drawing.Size(106, 35);
		this.btnSi.TabIndex = 37;
		this.btnSi.Text = "Si";
		this.btnSi.UseVisualStyleBackColor = false;
		this.btnSi.Click += new System.EventHandler(btnSi_Click);
		this.pnlFooter.BackColor = System.Drawing.Color.FromArgb(0, 52, 106);
		this.pnlFooter.BackgroundImageLayout = System.Windows.Forms.ImageLayout.Stretch;
		this.pnlFooter.Controls.Add(this.btnNo);
		this.pnlFooter.Controls.Add(this.btnSi);
		this.pnlFooter.Dock = System.Windows.Forms.DockStyle.Bottom;
		this.pnlFooter.Location = new System.Drawing.Point(0, 298);
		this.pnlFooter.Name = "pnlFooter";
		this.pnlFooter.Size = new System.Drawing.Size(607, 50);
		this.pnlFooter.TabIndex = 39;
		this.panel1.BackColor = System.Drawing.Color.Transparent;
		this.panel1.BackgroundImageLayout = System.Windows.Forms.ImageLayout.Stretch;
		this.panel1.Controls.Add(this.lblDetalle);
		this.panel1.Dock = System.Windows.Forms.DockStyle.Fill;
		this.panel1.Location = new System.Drawing.Point(0, 63);
		this.panel1.Name = "panel1";
		this.panel1.Size = new System.Drawing.Size(607, 235);
		this.panel1.TabIndex = 40;
		this.lblDetalle.Anchor = System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Left | System.Windows.Forms.AnchorStyles.Right;
		this.lblDetalle.BackColor = System.Drawing.Color.Transparent;
		this.lblDetalle.Font = new System.Drawing.Font("Segoe UI", 12f, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, 0);
		this.lblDetalle.ForeColor = System.Drawing.Color.Black;
		this.lblDetalle.Location = new System.Drawing.Point(17, 0);
		this.lblDetalle.Name = "lblDetalle";
		this.lblDetalle.Size = new System.Drawing.Size(572, 231);
		this.lblDetalle.TabIndex = 41;
		this.lblDetalle.Text = "Deberás elegir la opción correcta. (solo UNA)";
		this.lblDetalle.TextAlign = System.Drawing.ContentAlignment.MiddleCenter;
		base.AutoScaleDimensions = new System.Drawing.SizeF(6f, 13f);
		base.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
		this.BackColor = System.Drawing.Color.White;
		this.BackgroundImageLayout = System.Windows.Forms.ImageLayout.Stretch;
		base.ClientSize = new System.Drawing.Size(607, 348);
		base.Controls.Add(this.panel1);
		base.Controls.Add(this.pnlTitle);
		base.Controls.Add(this.pnlFooter);
		base.FormBorderStyle = System.Windows.Forms.FormBorderStyle.None;
		base.Icon = (System.Drawing.Icon)resources.GetObject("$this.Icon");
		base.Name = "Question";
		base.StartPosition = System.Windows.Forms.FormStartPosition.CenterParent;
		this.Text = "Question";
		base.Load += new System.EventHandler(Question_Load);
		this.pnlTitle.ResumeLayout(false);
		this.pnlFooter.ResumeLayout(false);
		this.panel1.ResumeLayout(false);
		base.ResumeLayout(false);
	}
}
