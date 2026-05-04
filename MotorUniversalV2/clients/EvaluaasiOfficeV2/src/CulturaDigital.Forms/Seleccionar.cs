using System;
using System.ComponentModel;
using System.Drawing;
using System.Windows.Forms;
using CulturaDigital.Helpers;

namespace CulturaDigital.Forms;

public class Seleccionar : Form
{
	private IContainer components;

	private ComboBox ExamenesComboBox;

	private Button aceptarButton;

	private Button cancelarButton;

	public Label mensajeLabel;

	public Label mensaje2Label;

	public Seleccionar(string msj1, string msj2)
	{
		InitializeComponent();
		mensajeLabel.Text = msj1;
		mensaje2Label.Text = msj2;
	}

	private void Seleccionar_Load(object sender, EventArgs e)
	{
		for (int i = 0; i < DatosEvaluacion.Opciones.Length / 5; i++)
		{
			if (!string.IsNullOrEmpty(DatosEvaluacion.Opciones[i, 0]))
			{
				ExamenesComboBox.Items.Add(DatosEvaluacion.Opciones[i, 0]);
			}
		}
	}

	private void aceptarButton_Click(object sender, EventArgs e)
	{
		if (ExamenesComboBox.SelectedItem == null)
		{
			return;
		}
		for (int i = 0; i < ExamenesComboBox.Items.Count; i++)
		{
			if (DatosEvaluacion.Opciones[i, 0].Equals(ExamenesComboBox.SelectedItem.ToString()))
			{
				DatosEvaluacion.Nombre = DatosEvaluacion.Opciones[i, 0];
				DatosEvaluacion.Examen = DatosEvaluacion.Opciones[i, 1];
				DatosEvaluacion.Licencia = DatosEvaluacion.Opciones[i, 2];
				DatosEvaluacion.IdAplicacion = DatosEvaluacion.Opciones[i, 3];
				DatosEvaluacion.Letra = DatosEvaluacion.Opciones[i, 4];
			}
		}
		Close();
	}

	private void cancelarButton_Click(object sender, EventArgs e)
	{
		DatosEvaluacion.Examen = string.Empty;
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
		System.ComponentModel.ComponentResourceManager componentResourceManager = new System.ComponentModel.ComponentResourceManager(typeof(CulturaDigital.Forms.Seleccionar));
		this.mensaje2Label = new System.Windows.Forms.Label();
		this.ExamenesComboBox = new System.Windows.Forms.ComboBox();
		this.mensajeLabel = new System.Windows.Forms.Label();
		this.aceptarButton = new System.Windows.Forms.Button();
		this.cancelarButton = new System.Windows.Forms.Button();
		base.SuspendLayout();
		this.mensaje2Label.BackColor = System.Drawing.Color.Transparent;
		componentResourceManager.ApplyResources(this.mensaje2Label, "mensaje2Label");
		this.mensaje2Label.Name = "mensaje2Label";
		this.ExamenesComboBox.BackColor = System.Drawing.SystemColors.Window;
		this.ExamenesComboBox.FormattingEnabled = true;
		componentResourceManager.ApplyResources(this.ExamenesComboBox, "ExamenesComboBox");
		this.ExamenesComboBox.Name = "ExamenesComboBox";
		this.mensajeLabel.BackColor = System.Drawing.Color.Transparent;
		componentResourceManager.ApplyResources(this.mensajeLabel, "mensajeLabel");
		this.mensajeLabel.Name = "mensajeLabel";
		this.aceptarButton.BackColor = System.Drawing.Color.WhiteSmoke;
		this.aceptarButton.Cursor = System.Windows.Forms.Cursors.Default;
		this.aceptarButton.FlatAppearance.BorderColor = System.Drawing.Color.Gainsboro;
		this.aceptarButton.FlatAppearance.CheckedBackColor = System.Drawing.Color.Gainsboro;
		this.aceptarButton.FlatAppearance.MouseDownBackColor = System.Drawing.Color.LightGray;
		this.aceptarButton.FlatAppearance.MouseOverBackColor = System.Drawing.Color.Gainsboro;
		componentResourceManager.ApplyResources(this.aceptarButton, "aceptarButton");
		this.aceptarButton.Name = "aceptarButton";
		this.aceptarButton.UseVisualStyleBackColor = false;
		this.aceptarButton.Click += new System.EventHandler(aceptarButton_Click);
		this.cancelarButton.BackColor = System.Drawing.Color.WhiteSmoke;
		this.cancelarButton.Cursor = System.Windows.Forms.Cursors.Default;
		this.cancelarButton.DialogResult = System.Windows.Forms.DialogResult.Cancel;
		this.cancelarButton.FlatAppearance.BorderColor = System.Drawing.Color.Gainsboro;
		this.cancelarButton.FlatAppearance.CheckedBackColor = System.Drawing.Color.Gainsboro;
		this.cancelarButton.FlatAppearance.MouseDownBackColor = System.Drawing.Color.LightGray;
		this.cancelarButton.FlatAppearance.MouseOverBackColor = System.Drawing.Color.Gainsboro;
		componentResourceManager.ApplyResources(this.cancelarButton, "cancelarButton");
		this.cancelarButton.Name = "cancelarButton";
		this.cancelarButton.UseVisualStyleBackColor = false;
		this.cancelarButton.Click += new System.EventHandler(cancelarButton_Click);
		base.AcceptButton = this.aceptarButton;
		componentResourceManager.ApplyResources(this, "$this");
		base.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
		this.BackColor = System.Drawing.SystemColors.Window;
		base.CancelButton = this.cancelarButton;
		base.ControlBox = false;
		base.Controls.Add(this.cancelarButton);
		base.Controls.Add(this.aceptarButton);
		base.Controls.Add(this.mensajeLabel);
		base.Controls.Add(this.ExamenesComboBox);
		base.Controls.Add(this.mensaje2Label);
		this.DoubleBuffered = true;
		base.FormBorderStyle = System.Windows.Forms.FormBorderStyle.FixedToolWindow;
		base.MaximizeBox = false;
		base.MinimizeBox = false;
		base.Name = "Seleccionar";
		base.ShowIcon = false;
		base.Load += new System.EventHandler(Seleccionar_Load);
		base.ResumeLayout(false);
	}
}
