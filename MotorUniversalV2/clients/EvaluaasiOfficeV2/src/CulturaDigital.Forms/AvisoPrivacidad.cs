using System;
using System.ComponentModel;
using System.Drawing;
using System.Windows.Forms;

namespace CulturaDigital.Forms;

public class AvisoPrivacidad : Form
{
	private IContainer components;

	private Panel panel1;

	private Panel panel2;

	private Button btnSi;

	public WebBrowser wb1;

	public Button btnNo;

	public AvisoPrivacidad()
	{
		InitializeComponent();
	}

	private void btnSi_Click(object sender, EventArgs e)
	{
		base.DialogResult = DialogResult.OK;
		Close();
	}

	private void btnNo_Click(object sender, EventArgs e)
	{
		base.DialogResult = DialogResult.Cancel;
		Close();
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
		System.ComponentModel.ComponentResourceManager resources = new System.ComponentModel.ComponentResourceManager(typeof(CulturaDigital.Forms.AvisoPrivacidad));
		this.panel1 = new System.Windows.Forms.Panel();
		this.btnNo = new System.Windows.Forms.Button();
		this.btnSi = new System.Windows.Forms.Button();
		this.panel2 = new System.Windows.Forms.Panel();
		this.wb1 = new System.Windows.Forms.WebBrowser();
		this.panel1.SuspendLayout();
		this.panel2.SuspendLayout();
		base.SuspendLayout();
		this.panel1.BackColor = System.Drawing.Color.Black;
		this.panel1.Controls.Add(this.btnNo);
		this.panel1.Controls.Add(this.btnSi);
		this.panel1.Dock = System.Windows.Forms.DockStyle.Bottom;
		this.panel1.Location = new System.Drawing.Point(0, 557);
		this.panel1.Name = "panel1";
		this.panel1.Size = new System.Drawing.Size(700, 43);
		this.panel1.TabIndex = 0;
		this.btnNo.BackColor = System.Drawing.Color.White;
		this.btnNo.FlatStyle = System.Windows.Forms.FlatStyle.Flat;
		this.btnNo.Font = new System.Drawing.Font("Arial", 12f, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, 0);
		this.btnNo.Location = new System.Drawing.Point(3, 4);
		this.btnNo.Name = "btnNo";
		this.btnNo.Size = new System.Drawing.Size(150, 34);
		this.btnNo.TabIndex = 0;
		this.btnNo.Text = "No acepto";
		this.btnNo.UseVisualStyleBackColor = false;
		this.btnNo.Click += new System.EventHandler(btnNo_Click);
		this.btnSi.Anchor = System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Right;
		this.btnSi.BackColor = System.Drawing.Color.White;
		this.btnSi.FlatStyle = System.Windows.Forms.FlatStyle.Flat;
		this.btnSi.Font = new System.Drawing.Font("Arial", 12f, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, 0);
		this.btnSi.Location = new System.Drawing.Point(547, 4);
		this.btnSi.Name = "btnSi";
		this.btnSi.Size = new System.Drawing.Size(150, 34);
		this.btnSi.TabIndex = 0;
		this.btnSi.Text = "Acepto";
		this.btnSi.UseVisualStyleBackColor = false;
		this.btnSi.Click += new System.EventHandler(btnSi_Click);
		this.panel2.Controls.Add(this.wb1);
		this.panel2.Dock = System.Windows.Forms.DockStyle.Fill;
		this.panel2.Location = new System.Drawing.Point(0, 0);
		this.panel2.Name = "panel2";
		this.panel2.Size = new System.Drawing.Size(700, 557);
		this.panel2.TabIndex = 1;
		this.wb1.Dock = System.Windows.Forms.DockStyle.Fill;
		this.wb1.Location = new System.Drawing.Point(0, 0);
		this.wb1.MinimumSize = new System.Drawing.Size(20, 20);
		this.wb1.Name = "wb1";
		this.wb1.Size = new System.Drawing.Size(700, 557);
		this.wb1.TabIndex = 0;
		base.AutoScaleDimensions = new System.Drawing.SizeF(6f, 13f);
		base.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
		this.BackgroundImageLayout = System.Windows.Forms.ImageLayout.None;
		base.ClientSize = new System.Drawing.Size(700, 600);
		base.Controls.Add(this.panel2);
		base.Controls.Add(this.panel1);
		base.FormBorderStyle = System.Windows.Forms.FormBorderStyle.None;
		base.Icon = (System.Drawing.Icon)resources.GetObject("$this.Icon");
		base.Name = "AvisoPrivacidad";
		base.StartPosition = System.Windows.Forms.FormStartPosition.CenterScreen;
		this.Text = "AvisoPrivacidad";
		this.panel1.ResumeLayout(false);
		this.panel2.ResumeLayout(false);
		base.ResumeLayout(false);
	}
}
