using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Drawing;
using System.Drawing.Imaging;
using System.Drawing.Text;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Windows.Forms;
using CulturaDigital.Controls;
using CulturaDigital.Helpers;
using CulturaDigital.Models;
using CulturaDigital.Models.Extensions;
using CulturaDigital.Properties;
using CulturaDigital.SkinControls;
using CulturaDigital.xmn;
using Gma.QrCodeNet.Encoding;
using Gma.QrCodeNet.Encoding.Windows.Render;
using iTextSharp.text;
using iTextSharp.text.pdf;

namespace CulturaDigital.Forms;

public class CulturaDigital_Examen : Form
{
	private static Random random = new Random();

	private ButtonEduIT bActual = new ButtonEduIT();

	private Pregunta p = new Pregunta();

	public Evaluacion evaluaasi = new Evaluacion();

	public List<Categoria> categorias = new List<Categoria>();

	public bool fechaEnLinea;

	public DateTime FechaInicio;

	private DateTime FechaFin;

	private int calificacion;

	private bool finalizado;

	public string NombrePC = "";

	public string VersionAplicacion = "";

	public string NombreUsuarioPC = "";

	public string DireccionIP = "";

	public string DireccionMAC = "";

	private string cabecera = "";

	private PrivateFontCollection _fonts = new PrivateFontCollection();

	private string appPath = Path.GetDirectoryName(Assembly.GetEntryAssembly().Location);

	private List<Control> controlesParaPanel = new List<Control>();

	private List<Control> controlesParaPanel2 = new List<Control>();

	private int segundos2 = 60;

	private int minutos;

	private string nombreArchivo = "";

	private IContainer components;

	private Panel pnlTitle;

	private Panel pnlsplash;

	private Panel pnlFooter;

	private Button btnCerrarExamen;

	private Panel pnlPreguntas;

	private Panel pnlOpcionMultiple;

	private Panel pnlSeleccionMultiple;

	private Label lblVoucher;

	private Panel pnlDragDrop;

	private FlowLayoutPanel pnlDestinoArrastrarSoltar;

	private FlowLayoutPanel pnlOrigenArrastrarSoltar;

	private Timer tmr;

	private Label lblVersion;

	private Panel pnlTextoPregunta;

	private Label lblTextoPregunta;

	private PictureBox pbHelp;

	private BackgroundWorker bgwFinalizar;

	private Panel pnlContenedorPaneles;

	private Panel pnlContenedorTimmer;

	private Panel pnlContenedorTotales;

	private Label lblTextoOmitidas;

	private Label lblTextoResueltas;

	private Label lblTextoRestantes;

	private Button btnResueltasCount;

	private Button btnRestantesCount;

	private Button btnOmitidasCount;

	private Panel pnlContenedorBotones;

	private Button btnOmitir;

	private Button btnReiniciar;

	private Button btnFinalizar;

	private PictureBox pbSpinner;

	private Label lblMinutos;

	private SkinImage skinImage1;

	private Panel PnlDragDropPanels;

	private FlowLayoutPanel flpOrdenamiento;

	private PictureBox pbtitulo;

	private BackgroundWorker bgwCargarPregunta;

	private Label nombreExamenLbl;

	private Panel pnlArrastraOrdena;

	private FlowLayoutPanel pnlOrigenArrastrarOrdenar;

	private FlowLayoutPanel pnlDestinoArrastrarOrdenar;

	private Label tipoLbl;

	public bool InLine { get; set; }

	public Usuario User { get; set; }

	public Voucher V { get; set; }

	public CulturaDigital_Examen()
	{
		SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.DoubleBuffer, value: true);
		SetStyle(ControlStyles.UserPaint, value: true);
		InitializeComponent();
		SetDoubleBuffered(pnlContenedorPaneles);
		SetDoubleBuffered(pnlContenedorBotones);
		SetDoubleBuffered(pnlContenedorTimmer);
		SetDoubleBuffered(pnlContenedorTotales);
		SetDoubleBuffered(pnlDestinoArrastrarSoltar);
		SetDoubleBuffered(pnlDragDrop);
		SetDoubleBuffered(PnlDragDropPanels);
		SetDoubleBuffered(pnlFooter);
		SetDoubleBuffered(pnlOpcionMultiple);
		SetDoubleBuffered(pnlOrigenArrastrarSoltar);
		SetDoubleBuffered(pnlPreguntas);
		SetDoubleBuffered(pnlSeleccionMultiple);
		SetDoubleBuffered(pnlTextoPregunta);
		SetDoubleBuffered(pnlsplash);
		pnlDestinoArrastrarSoltar.BackColor = Color.FromArgb(30, Color.White);
		pnlOrigenArrastrarSoltar.BackColor = Color.FromArgb(30, Color.White);
		pnlOrigenArrastrarOrdenar.BackColor = Color.FromArgb(30, Color.White);
		pnlDestinoArrastrarOrdenar.BackColor = Color.FromArgb(30, Color.White);
	}

	private void Examen_Load(object sender, EventArgs e)
	{
		try
		{
			if (File.Exists(Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/fondo_preguntas.png")))
			{
				pnlsplash.BackgroundImage = System.Drawing.Image.FromFile(Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/fondo_preguntas.png"));
				pnlOpcionMultiple.BackgroundImage = System.Drawing.Image.FromFile(Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/fondo_preguntas.png"));
				pnlSeleccionMultiple.BackgroundImage = System.Drawing.Image.FromFile(Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/fondo_preguntas.png"));
				pnlPreguntas.BackgroundImage = System.Drawing.Image.FromFile(Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/fondo_preguntas.png"));
				PnlDragDropPanels.BackgroundImage = System.Drawing.Image.FromFile(Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/fondo_preguntas.png"));
				pnlDragDrop.BackgroundImage = System.Drawing.Image.FromFile(Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/fondo_preguntas.png"));
				pnlArrastraOrdena.BackgroundImage = System.Drawing.Image.FromFile(Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/fondo_preguntas.png"));
			}
			else
			{
				pnlOpcionMultiple.BackColor = Color.FromArgb(26, 47, 68);
				pnlSeleccionMultiple.BackColor = Color.FromArgb(26, 47, 68);
				pnlPreguntas.BackColor = Color.FromArgb(26, 47, 68);
				PnlDragDropPanels.BackColor = Color.FromArgb(26, 47, 68);
				pnlDragDrop.BackColor = Color.FromArgb(26, 47, 68);
				pnlArrastraOrdena.BackColor = Color.FromArgb(26, 47, 68);
			}
			if (File.Exists(Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/pleca_superior.png")))
			{
				pnlTitle.BackgroundImage = System.Drawing.Image.FromFile(Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/pleca_superior.png"));
			}
			if (File.Exists(Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/titulo_examen.png")))
			{
				pbtitulo.BackgroundImage = System.Drawing.Image.FromFile(Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/titulo_examen.png"));
			}
			else
			{
				nombreExamenLbl.Visible = true;
				nombreExamenLbl.Text = DatosEvaluacion.Nombre;
			}
			if (File.Exists(Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/indicaciones_examen.png")))
			{
				pnlFooter.BackgroundImage = System.Drawing.Image.FromFile(Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/indicaciones_examen.png"));
			}
		}
		catch (Exception)
		{
		}
		if (File.Exists("DS-DIGI.TTF"))
		{
			_fonts.AddFontFile("DS-DIGI.TTF");
			lblMinutos.Font = new System.Drawing.Font(_fonts.Families[0], 27.75f);
			btnResueltasCount.Font = new System.Drawing.Font(_fonts.Families[0], 24.75f);
			btnRestantesCount.Font = new System.Drawing.Font(_fonts.Families[0], 24.75f);
			btnOmitidasCount.Font = new System.Drawing.Font(_fonts.Families[0], 24.75f);
		}
		OcultarPaneles(visible: false);
		base.WindowState = FormWindowState.Maximized;
		lblVoucher.RightToLeft = RightToLeft.Yes;
		lblVersion.Text = VersionAplicacion;
		btnRestantesCount.Text = evaluaasi.Preguntas.Count().ToString();
		btnOmitidasCount.Text = "0";
		btnResueltasCount.Text = "0";
		minutos = evaluaasi.Minutos - 1;
		ToolTip toolTip = new ToolTip();
		toolTip.AutoPopDelay = 3000;
		toolTip.InitialDelay = 500;
		toolTip.ReshowDelay = 300;
		toolTip.ShowAlways = true;
		toolTip.SetToolTip(btnFinalizar, "Evaluar");
		toolTip.SetToolTip(btnOmitir, "Omitir");
		toolTip.SetToolTip(btnReiniciar, "Reiniciar");
		toolTip.SetToolTip(lblMinutos, "Minutos:Segundos");
		p = evaluaasi.Preguntas.First();
		lblVoucher.Text = "Voucher : " + V.VoucherCode + " - " + p.PreguntaId.PonerCeros(3);
		lblTextoPregunta.Text = p.Texto;
		bgwCargarPregunta.RunWorkerAsync();
		tmr.Enabled = true;
		FechaInicio = DateTime.Now;
		int num = (int)Math.Round((decimal)(pnlDragDrop.Size.Width / 2), MidpointRounding.AwayFromZero) - 20;
		pnlOrigenArrastrarSoltar.Width = num;
		pnlDestinoArrastrarSoltar.Width = num;
		pnlDestinoArrastrarSoltar.Location = new Point(num + 30, 17);
		pnlOrigenArrastrarSoltar.Height = pnlDragDrop.Height - 40;
		pnlDestinoArrastrarSoltar.Height = pnlDragDrop.Height - 40;
		int num2 = (int)Math.Round((decimal)(pnlArrastraOrdena.Size.Width / 2), MidpointRounding.AwayFromZero) - 20;
		pnlOrigenArrastrarOrdenar.Width = num2;
		pnlDestinoArrastrarOrdenar.Width = num2;
		pnlDestinoArrastrarOrdenar.Location = new Point(num2 + 30, 17);
		pnlOrigenArrastrarOrdenar.Height = pnlArrastraOrdena.Height - 40;
		pnlDestinoArrastrarOrdenar.Height = pnlArrastraOrdena.Height - 40;
		tipoLbl.Text = p.TipoPregunta.ObtieneTipo();
		lblTextoPregunta.MaximumSize = new Size(pnlTextoPregunta.Width - 20, 1000);
		pnlTextoPregunta.AutoScroll = lblTextoPregunta.Height > pnlTextoPregunta.Height;
		pnlTextoPregunta.Refresh();
	}

	private void btnOmitir_Click(object sender, EventArgs e)
	{
		new ButtonEduIT();
		try
		{
			if (new Question
			{
				BackgroundImage = Resources.fondo_azul,
				lblTitulo = 
				{
					Text = "Dejar para después"
				},
				lblDetalle = 
				{
					Text = "Al dejar para después, perderás los cambios realizados en este ejercicio y deberás resolverlo al final del examen. ¿deseas continuar?"
				},
				Height = 180
			}.ShowDialog() != DialogResult.OK)
			{
				return;
			}
			evaluaasi.Preguntas.Where((Pregunta m) => m.PreguntaId == p.PreguntaId).First().Estatus = 1;
			btnResueltasCount.Text = evaluaasi.Preguntas.Where((Pregunta m) => m.Estatus == 2).Count().ToString();
			btnRestantesCount.Text = evaluaasi.Preguntas.Where((Pregunta m) => m.Estatus == 0).Count().ToString();
			btnOmitidasCount.Text = evaluaasi.Preguntas.Where((Pregunta m) => m.Estatus == 1).Count().ToString();
			if (evaluaasi.Preguntas.Where((Pregunta m) => m.PreguntaId != p.PreguntaId && m.Estatus == 0).ToList().Count > 0)
			{
				btnOmitir.Visible = true;
				p = evaluaasi.Preguntas.Where((Pregunta m) => m.PreguntaId != p.PreguntaId && m.Estatus == 0).First();
			}
			else
			{
				btnOmitir.Visible = false;
				p = evaluaasi.Preguntas.Where((Pregunta m) => m.Estatus == 1).First();
			}
			lblTextoPregunta.Text = p.Texto;
			lblVoucher.Text = "Voucher : " + V.VoucherCode + " - " + p.PreguntaId.PonerCeros(3);
			CargarPanel2(p);
			tipoLbl.Text = p.TipoPregunta.ObtieneTipo();
			lblTextoPregunta.MaximumSize = new Size(pnlTextoPregunta.Width - 20, 1000);
			pnlTextoPregunta.AutoScroll = lblTextoPregunta.Height > pnlTextoPregunta.Height;
			pnlTextoPregunta.Refresh();
		}
		catch (Exception)
		{
		}
	}

	private void btnReiniciar_Click(object sender, EventArgs e)
	{
		new PictureEduIt();
		try
		{
			DialogResult num = new Question
			{
				lblTitulo = 
				{
					Text = "Reiniciar pregunta"
				},
				lblDetalle = 
				{
					Text = "Perderás los cambios realizados en este ejercicio, ¿Deseas continuar?"
				},
				Height = 180
			}.ShowDialog();
			p.Estatus = 0;
			p.Opciones = evaluaasi.Preguntas.Where((Pregunta m) => m.PreguntaId == p.PreguntaId).First().Opciones;
			Pregunta pregunta = evaluaasi.Preguntas.Where((Pregunta m) => m.PreguntaId == p.PreguntaId).FirstOrDefault();
			tipoLbl.Text = pregunta.TipoPregunta.ObtieneTipo();
			if (num != DialogResult.OK)
			{
				return;
			}
			switch (p.TipoPregunta)
			{
			case eTipoPregunta.OpcionMultiple:
				if (pnlOpcionMultiple.Controls.Count > 2)
				{
					foreach (Control control6 in pnlOpcionMultiple.Controls)
					{
						if (control6 is SkinRadioButton)
						{
							Point location5 = ((SkinRadioButton)control6).Location;
							int index3 = random.Next(0, pnlOpcionMultiple.Controls.Count);
							((SkinRadioButton)control6).Location = pnlOpcionMultiple.Controls[index3].Location;
							pnlOpcionMultiple.Controls[index3].Location = location5;
							((SkinRadioButton)control6).Checked = false;
						}
					}
					break;
				}
				if (pnlOpcionMultiple.Controls.Count == 2)
				{
					Point location6 = pnlOpcionMultiple.Controls[0].Location;
					pnlOpcionMultiple.Controls[0].Location = pnlOpcionMultiple.Controls[1].Location;
					pnlOpcionMultiple.Controls[1].Location = location6;
				}
				break;
			case eTipoPregunta.SeleccionMultiple:
				BooleanExtensions.IniciarPanel(visible: true, ref pnlSeleccionMultiple);
				pnlSeleccionMultiple.Controls.AddRange(controlesParaPanel.ToArray());
				foreach (object c in pnlSeleccionMultiple.Controls)
				{
					if (c is CheckBoxEduIT)
					{
						((CheckBoxEduIT)c).CheckState = CheckState.Unchecked;
						Opcion opcion = p.Opciones.Where((Opcion m) => m.OpcionId == ((CheckBoxEduIT)c).Value).First();
						p.Respuesta += p.Respuesta.Replace(opcion.OpcionId + ",", "");
						p.Opciones.Where((Opcion m) => m.OpcionId == ((CheckBoxEduIT)c).Value).First().Seleccionada = false;
					}
				}
				CargarPanel2(pregunta);
				break;
			case eTipoPregunta.ArrastrarSoltar:
				BooleanExtensions.IniciarPanel(visible: true, ref pnlDragDrop);
				pnlOrigenArrastrarSoltar.Controls.AddRange(controlesParaPanel.ToArray());
				pnlDestinoArrastrarSoltar.Controls.AddRange(controlesParaPanel2.ToArray());
				pnlOrigenArrastrarSoltar.Controls.Clear();
				pnlDestinoArrastrarSoltar.Controls.Clear();
				foreach (Opcion opcione in pregunta.Opciones)
				{
					opcione.Seleccionada = false;
				}
				CargarPanel2(pregunta);
				break;
			case eTipoPregunta.Ordenamiento:
				BooleanExtensions.IniciarPanel(visible: true, ref PnlDragDropPanels);
				if (pnlOpcionMultiple.Controls.Count > 2)
				{
					foreach (Control control7 in pnlOpcionMultiple.Controls)
					{
						if (control7 is HarrProgressBar)
						{
							Point location3 = control7.Location;
							int index2 = random.Next(0, pnlOpcionMultiple.Controls.Count);
							control7.Location = pnlOpcionMultiple.Controls[index2].Location;
							pnlOpcionMultiple.Controls[index2].Location = location3;
						}
					}
				}
				else if (pnlOpcionMultiple.Controls.Count == 2)
				{
					Point location4 = pnlOpcionMultiple.Controls[0].Location;
					pnlOpcionMultiple.Controls[0].Location = pnlOpcionMultiple.Controls[1].Location;
					pnlOpcionMultiple.Controls[1].Location = location4;
				}
				CargarPanel2(pregunta);
				break;
			case eTipoPregunta.TrueFalse:
			{
				BooleanExtensions.IniciarPanel(visible: true, ref pnlSeleccionMultiple);
				if (pnlSeleccionMultiple.Controls.Count > 2)
				{
					foreach (Control control8 in pnlSeleccionMultiple.Controls)
					{
						if (control8 is PanelEduIT)
						{
							foreach (Control control9 in control8.Controls)
							{
								if (control9 is ToggleButton)
								{
									((ToggleButton)control9).ToggleState = ToggleButton.ToggleButtonState.OFF;
								}
							}
							Point location = control8.Location;
							int index = random.Next(0, pnlSeleccionMultiple.Controls.Count);
							control8.Location = pnlSeleccionMultiple.Controls[index].Location;
							pnlSeleccionMultiple.Controls[index].Location = location;
						}
					}
					break;
				}
				if (pnlSeleccionMultiple.Controls.Count != 2)
				{
					break;
				}
				Point location2 = pnlSeleccionMultiple.Controls[0].Location;
				pnlSeleccionMultiple.Controls[0].Location = pnlSeleccionMultiple.Controls[1].Location;
				pnlSeleccionMultiple.Controls[1].Location = location2;
				foreach (Control control10 in pnlSeleccionMultiple.Controls[0].Controls)
				{
					if (control10 is ToggleButton)
					{
						((ToggleButton)control10).ToggleState = ToggleButton.ToggleButtonState.OFF;
					}
				}
				{
					foreach (Control control11 in pnlSeleccionMultiple.Controls[1].Controls)
					{
						if (control11 is ToggleButton)
						{
							((ToggleButton)control11).ToggleState = ToggleButton.ToggleButtonState.OFF;
						}
					}
					break;
				}
			}
			case eTipoPregunta.OrdenarPanelDragDrop:
				BooleanExtensions.IniciarPanel(visible: true, ref pnlArrastraOrdena);
				pnlOrigenArrastrarOrdenar.Controls.AddRange(controlesParaPanel.ToArray());
				pnlDestinoArrastrarOrdenar.Controls.AddRange(controlesParaPanel2.ToArray());
				pnlOrigenArrastrarOrdenar.Controls.Clear();
				pnlDestinoArrastrarOrdenar.Controls.Clear();
				foreach (Opcion opcione2 in pregunta.Opciones)
				{
					opcione2.Seleccionada = false;
				}
				CargarPanel2(pregunta);
				break;
			}
		}
		catch (Exception)
		{
		}
	}

	private void btnFinalizar_Click(object sender, EventArgs e)
	{
		evaluaasi.Preguntas.Where((Pregunta m) => m.PreguntaId == p.PreguntaId).First().Estatus = 2;
		if (evaluaasi.Preguntas.Count() > evaluaasi.Preguntas.Where((Pregunta m) => m.Estatus == 2).Count())
		{
			pnlTextoPregunta.AutoScroll = false;
			pnlTextoPregunta.Refresh();
			btnResueltasCount.Text = evaluaasi.Preguntas.Where((Pregunta m) => m.Estatus == 2).Count().ToString();
			btnRestantesCount.Text = evaluaasi.Preguntas.Where((Pregunta m) => m.Estatus == 0).Count().ToString();
			btnOmitidasCount.Text = evaluaasi.Preguntas.Where((Pregunta m) => m.Estatus == 1).Count().ToString();
			List<Pregunta> list = evaluaasi.Preguntas.Where((Pregunta m) => m.PreguntaId != p.PreguntaId && m.Estatus == 0).ToList();
			if (list.Count > 0)
			{
				p = evaluaasi.Preguntas.Where((Pregunta m) => m.PreguntaId != p.PreguntaId && m.Estatus == 0).First();
			}
			else
			{
				list = evaluaasi.Preguntas.Where((Pregunta m) => m.Estatus == 1).ToList();
				if (list.Count > 0)
				{
					p = list.First();
				}
			}
			lblTextoPregunta.Text = p.Texto;
			lblVoucher.Text = "Voucher : " + V.VoucherCode + " - " + p.PreguntaId.PonerCeros(3);
			CargarPanel2(p);
			tipoLbl.Text = p.TipoPregunta.ObtieneTipo();
			lblTextoPregunta.MaximumSize = new Size(pnlTextoPregunta.Width - 20, 1000);
			pnlTextoPregunta.AutoScroll = lblTextoPregunta.Height > pnlTextoPregunta.Height;
			pnlTextoPregunta.Refresh();
			return;
		}
		evaluaasi.Preguntas.Where((Pregunta m) => m.PreguntaId == p.PreguntaId).First().Estatus = 2;
		btnResueltasCount.Text = evaluaasi.Preguntas.Where((Pregunta m) => m.Estatus == 2).Count().ToString();
		btnRestantesCount.Text = evaluaasi.Preguntas.Where((Pregunta m) => m.Estatus == 0).Count().ToString();
		btnOmitidasCount.Text = evaluaasi.Preguntas.Where((Pregunta m) => m.Estatus == 1).Count().ToString();
		pnlsplash.BringToFront();
		lblTextoPregunta.Text = "";
		try
		{
			Question obj = new Question
			{
				lblTitulo = 
				{
					Text = "Evaluaasi"
				},
				lblDetalle = 
				{
					Text = "Has terminado el examen, a continuación se mostrará tu resultado." + Environment.NewLine + Environment.NewLine
				}
			};
			obj.lblDetalle.Text += "En la ventana de resultado, podrás hacer zoom a la vista preliminar del archivo de resultado utilizando la barra inferior.";
			obj.Height = 250;
			obj.btnSi.Text = "Finalizar";
			obj.btnSi.Visible = true;
			obj.btnNo.Visible = false;
			DialogResult dialogResult = obj.ShowDialog();
			if (dialogResult == DialogResult.OK || dialogResult == DialogResult.Cancel)
			{
				FinalizarExamen();
				return;
			}
			Help help = new Help();
			help.lblDetalle.Text = "Puede continuar con su evaluación.";
			help.lblTitulo.Text = "Evaluaasi";
			help.ShowDialog();
		}
		catch (Exception)
		{
		}
	}

	private void btnCerrarExamen_Click(object sender, EventArgs e)
	{
		Question question = new Question();
		question.BackgroundImage = Resources.fondo_azul;
		question.lblTitulo.Text = "Evaluaasi";
		question.lblDetalle.Text = "El examen se va a finalizar" + Environment.NewLine + Environment.NewLine;
		question.lblDetalle.Text = "Este proceso finalizará la aplicación del examen, a continuación se mostrará tu resultado." + Environment.NewLine + "En la ventana de resultado, podrás hacer zoom a la vista preliminar del archivo de resultado utilizando la barra inferior." + Environment.NewLine + "En caso de que desees finalizar el examen da clic sobre el botón Si." + Environment.NewLine + "En caso de que NO desees finalizar el examen da clic sobre el botón No.";
		question.Height = 450;
		question.btnSi.Visible = true;
		question.btnNo.Visible = true;
		if (question.ShowDialog() == DialogResult.OK)
		{
			"Finaliza examen desde botón cerrar del examen             ".Bitacora("000008", "Examen", "Fin   ", "000211", "000013");
			FinalizarExamen();
		}
	}

	private void Examen_FormClosing(object sender, FormClosingEventArgs e)
	{
		if (e.CloseReason == CloseReason.TaskManagerClosing)
		{
			"Cerrado por el taskmanager                                ".Bitacora("000008", "Examen", "Fin   ", "000211", "000013");
		}
		else if (e.CloseReason == CloseReason.FormOwnerClosing)
		{
			"Cerrado por el FormOwnerClosing                           ".Bitacora("000008", "Examen", "Fin   ", "000211", "000013");
		}
		else if (e.CloseReason == CloseReason.ApplicationExitCall)
		{
			"Se ha solicitado cerrar la aplicación desde el S.O.       ".Bitacora("000008", "Examen", "Fin   ", "000211", "000013");
		}
		else if (e.CloseReason == CloseReason.MdiFormClosing)
		{
			"MDIFormClosing                                            ".Bitacora("000008", "Examen", "Fin   ", "000211", "000013");
		}
		else if (e.CloseReason == CloseReason.UserClosing)
		{
			"Cerrado por el usuario                                    ".Bitacora("000008", "Examen", "Fin   ", "000211", "000013");
		}
		else if (e.CloseReason == CloseReason.WindowsShutDown)
		{
			"Se apaga el windows                                       ".Bitacora("000008", "Examen", "Fin   ", "000211", "000013");
		}
	}

	private void pictureBox1_Click(object sender, EventArgs e)
	{
		Help help = new Help();
		switch (p.TipoPregunta)
		{
		case eTipoPregunta.OpcionMultiple:
			help.lblTitulo.Text = "Opción múltiple";
			help.lblDetalle.Text = "Debes elegir solo una de las opciones dando clic sobre ella.";
			break;
		case eTipoPregunta.SeleccionMultiple:
			help.lblTitulo.Text = "Selección múltiple";
			help.lblDetalle.Text = "Debes elegir las opciones correctas dando clic sobre ellas.";
			break;
		case eTipoPregunta.ArrastrarSoltar:
			help.lblTitulo.Text = "Arrastrar y soltar";
			help.lblDetalle.Text = "Debes arrastrar las opciones correctas desde la columna de la izquierda y llevarlas a la columna de la derecha.";
			break;
		case eTipoPregunta.Ordenamiento:
			help.lblTitulo.Text = "Ordenar";
			help.lblDetalle.Text = "Debes ordenar los elementos arrastrándolos hasta la posición correcta, deben quedar todas las opciones en el orden correcto.";
			break;
		case eTipoPregunta.TrueFalse:
			help.lblTitulo.Text = "Verdadero o falso";
			help.lblDetalle.Text = "Debes arrastrar el control deslizable en la opción que consideres correcta";
			break;
		case eTipoPregunta.OrdenarPanelDragDrop:
			help.lblTitulo.Text = "Arrastrar y ordenar";
			help.lblDetalle.Text = "Debes arrastrar las opciones correctas desde la columna de la izquierda y llevarlas a la columna de la derecha en el orden correcto.";
			break;
		}
		help.ShowDialog();
	}

	private void radiobutton_checked(object sender, EventArgs e)
	{
		SkinRadioButton rba = (SkinRadioButton)sender;
		Opcion opcion = new Opcion();
		try
		{
			if (rba.Checked)
			{
				opcion = p.Opciones.Where((Opcion m) => m.OpcionId == rba.Value).First();
				p.Opciones.Where((Opcion m) => m.OpcionId == rba.Value).First().Seleccionada = true;
				p.Opciones.Where((Opcion m) => m.OpcionId != rba.Value).First().Seleccionada = false;
				p.Respuesta = opcion.OpcionId.ToString();
				if (opcion.Correcta)
				{
					p.Correcta = "true";
				}
				else
				{
					p.Correcta = "false";
				}
				btnConestado();
			}
		}
		catch (Exception)
		{
		}
	}

	private void OnCheck(object sender, EventArgs e)
	{
		CheckBoxEduIT rba = (CheckBoxEduIT)sender;
		Opcion opcion = p.Opciones.Where((Opcion m) => m.OpcionId == rba.Value).First();
		if (rba.CheckState == CheckState.Checked)
		{
			Pregunta pregunta = p;
			pregunta.Respuesta = pregunta.Respuesta + opcion.OpcionId + ",";
			p.Opciones.Where((Opcion m) => m.OpcionId == rba.Value).First().Seleccionada = true;
		}
		else if (rba.CheckState == CheckState.Unchecked)
		{
			p.Respuesta += p.Respuesta.Replace(opcion.OpcionId + ",", "");
			p.Opciones.Where((Opcion m) => m.OpcionId == rba.Value).First().Seleccionada = false;
		}
		int num = p.Opciones.Where((Opcion m) => m.Seleccionada && m.Correcta).Count();
		int num2 = p.Opciones.Where((Opcion m) => m.Seleccionada && !m.Correcta).Count();
		int num3 = p.Opciones.Where((Opcion m) => m.Correcta).Count();
		if (num == num3 && num2 == 0)
		{
			p.Correcta = "true";
		}
		else
		{
			p.Correcta = "false";
		}
		btnConestado();
	}

	private void flpArrastrarSoltar_DragDrop(object sender, DragEventArgs e)
	{
		int num = 0;
		int num2 = 0;
		HarrProgressBar harrProgressBar = (HarrProgressBar)e.Data.GetData(typeof(HarrProgressBar));
		FlowLayoutPanel flowLayoutPanel = (FlowLayoutPanel)sender;
		FlowLayoutPanel flowLayoutPanel2 = (FlowLayoutPanel)harrProgressBar.Parent;
		if (flowLayoutPanel2 != flowLayoutPanel)
		{
			flowLayoutPanel.Controls.Add(harrProgressBar);
			harrProgressBar.Size = new Size(flowLayoutPanel.Width, harrProgressBar.Height);
			Point pt = flowLayoutPanel.PointToClient(new Point(e.X, e.Y));
			Control childAtPoint = flowLayoutPanel.GetChildAtPoint(pt);
			num = flowLayoutPanel.Controls.GetChildIndex(childAtPoint, throwException: false);
			flowLayoutPanel.Controls.SetChildIndex(harrProgressBar, num);
			flowLayoutPanel.Invalidate();
			flowLayoutPanel2.Invalidate();
		}
		else
		{
			Point pt2 = flowLayoutPanel.PointToClient(new Point(e.X, e.Y));
			Control childAtPoint2 = flowLayoutPanel.GetChildAtPoint(pt2);
			num = flowLayoutPanel.Controls.GetChildIndex(childAtPoint2, throwException: false);
			flowLayoutPanel.Controls.SetChildIndex(harrProgressBar, num);
			flowLayoutPanel.Invalidate();
		}
		int num3 = 0;
		foreach (HarrProgressBar d in pnlDestinoArrastrarSoltar.Controls)
		{
			num3++;
			d.OrdenSeleccionado = num3;
			p.Opciones.Where((Opcion m) => m.OpcionId == d.OpcionId).First().Seleccionada = true;
			if (p.Opciones.Where((Opcion m) => m.OpcionId == d.OpcionId).FirstOrDefault().Correcta)
			{
				d.Correcta = true;
				num2++;
			}
			else
			{
				d.Correcta = false;
				num2--;
			}
		}
		if (num2 == p.Opciones.Where((Opcion q) => q.Correcta).Count())
		{
			p.Correcta = "true";
		}
		else
		{
			p.Correcta = "false";
		}
	}

	private void flpArrastrarSoltar_DragEnter(object sender, DragEventArgs e)
	{
		e.Effect = DragDropEffects.Move;
		btnConestado();
	}

	private void flpOrdenamiento_DragDrop(object sender, DragEventArgs e)
	{
		HarrProgressBar harrProgressBar = (HarrProgressBar)e.Data.GetData(typeof(HarrProgressBar));
		FlowLayoutPanel flowLayoutPanel = (FlowLayoutPanel)sender;
		FlowLayoutPanel flowLayoutPanel2 = (FlowLayoutPanel)harrProgressBar.Parent;
		Point pt = flowLayoutPanel.PointToClient(new Point(e.X, e.Y));
		Control childAtPoint = flowLayoutPanel.GetChildAtPoint(pt);
		int childIndex = flowLayoutPanel.Controls.GetChildIndex(childAtPoint, throwException: false);
		flowLayoutPanel.Controls.SetChildIndex(harrProgressBar, childIndex);
		int num = 0;
		if (harrProgressBar.Orden == harrProgressBar.OrdenSeleccionado)
		{
			harrProgressBar.Correcta = true;
		}
		if (flowLayoutPanel2 != flowLayoutPanel)
		{
			flowLayoutPanel.Controls.Add(harrProgressBar);
			harrProgressBar.Size = new Size(flowLayoutPanel.Width, harrProgressBar.Height);
			flowLayoutPanel.Invalidate();
			flowLayoutPanel2.Invalidate();
		}
		else
		{
			flowLayoutPanel.Invalidate();
		}
		foreach (HarrProgressBar d in flpOrdenamiento.Controls)
		{
			d.OrdenSeleccionado = flpOrdenamiento.Controls.IndexOf(d) + 1;
			p.Opciones.Where((Opcion m) => m.OpcionId == d.OpcionId).First().OrdenSeleccionado = d.OrdenSeleccionado;
			if (d.Orden == d.OrdenSeleccionado)
			{
				d.Correcta = true;
				num++;
			}
		}
		if (num == flpOrdenamiento.Controls.Count)
		{
			p.Correcta = "true";
		}
		else
		{
			p.Correcta = "false";
		}
	}

	private void flpOrdenamiento_DragEnter(object sender, DragEventArgs e)
	{
		e.Effect = DragDropEffects.Move;
		btnConestado();
	}

	private void OnCheckTrueFalse(object sender, ToggleButton.ToggleButtonStateEventArgs e)
	{
		ToggleButton tb = (ToggleButton)sender;
		Opcion opcion = p.Opciones.Where((Opcion m) => m.OpcionId == tb.Value).First();
		Opcion ot = p.Opciones.Where((Opcion q) => q.OpcionId != tb.Value).FirstOrDefault();
		if (tb.ToggleState == ToggleButton.ToggleButtonState.OFF)
		{
			Pregunta pregunta = p;
			pregunta.Respuesta = pregunta.Respuesta + opcion.OpcionId + ",";
			p.Opciones.Where((Opcion m) => m.OpcionId == tb.Value).First().Seleccionada = true;
			p.Opciones.Where((Opcion m) => m.OpcionId == ot.OpcionId).First().Seleccionada = false;
			foreach (Control control3 in pnlSeleccionMultiple.Controls)
			{
				if (!(control3 is PanelEduIT))
				{
					continue;
				}
				foreach (Control control4 in control3.Controls)
				{
					if (control4 is ToggleButton && ((ToggleButton)control4).Value == ot.OpcionId)
					{
						((ToggleButton)control4).ToggleState = ToggleButton.ToggleButtonState.OFF;
					}
				}
			}
		}
		else if (tb.ToggleState == ToggleButton.ToggleButtonState.ON)
		{
			p.Respuesta += p.Respuesta.Replace(opcion.OpcionId + ",", "");
			p.Opciones.Where((Opcion m) => m.OpcionId == tb.Value).First().Seleccionada = false;
		}
		if (p.Opciones.Where((Opcion m) => m.Seleccionada == m.Correcta).Count() == p.Opciones.Count())
		{
			p.Correcta = "true";
		}
		else
		{
			p.Correcta = "false";
		}
		btnConestado();
	}

	private void ArrastrarOrdenar_DragDrop(object sender, DragEventArgs e)
	{
		int num = 0;
		int num2 = 0;
		HarrProgressBar harrProgressBar = (HarrProgressBar)e.Data.GetData(typeof(HarrProgressBar));
		FlowLayoutPanel flowLayoutPanel = (FlowLayoutPanel)sender;
		FlowLayoutPanel flowLayoutPanel2 = (FlowLayoutPanel)harrProgressBar.Parent;
		if (flowLayoutPanel2 != flowLayoutPanel)
		{
			flowLayoutPanel.Controls.Add(harrProgressBar);
			harrProgressBar.Size = new Size(flowLayoutPanel.Width, harrProgressBar.Height);
			Point pt = flowLayoutPanel.PointToClient(new Point(e.X, e.Y));
			Control childAtPoint = flowLayoutPanel.GetChildAtPoint(pt);
			num = flowLayoutPanel.Controls.GetChildIndex(childAtPoint, throwException: false);
			flowLayoutPanel.Controls.SetChildIndex(harrProgressBar, num);
			flowLayoutPanel.Invalidate();
			flowLayoutPanel2.Invalidate();
		}
		else
		{
			Point pt2 = flowLayoutPanel.PointToClient(new Point(e.X, e.Y));
			Control childAtPoint2 = flowLayoutPanel.GetChildAtPoint(pt2);
			num = flowLayoutPanel.Controls.GetChildIndex(childAtPoint2, throwException: false);
			flowLayoutPanel.Controls.SetChildIndex(harrProgressBar, num);
			flowLayoutPanel.Invalidate();
		}
		int num3 = 0;
		foreach (HarrProgressBar d in pnlDestinoArrastrarOrdenar.Controls)
		{
			num3++;
			d.OrdenSeleccionado = num3;
			p.Opciones.Where((Opcion m) => m.OpcionId == d.OpcionId).First().OrdenSeleccionado = num3;
			p.Opciones.Where((Opcion m) => m.OpcionId == d.OpcionId).First().Seleccionada = true;
			if (d.Orden == d.OrdenSeleccionado && p.Opciones.Where((Opcion m) => m.OpcionId == d.OpcionId).FirstOrDefault().Correcta)
			{
				d.Correcta = true;
				num2++;
			}
			else
			{
				d.Correcta = false;
				num2--;
			}
		}
		if (num2 == p.Opciones.Where((Opcion q) => q.Correcta).Count())
		{
			p.Correcta = "true";
		}
		else
		{
			p.Correcta = "false";
		}
	}

	private void ArrastrarOrdenar_DragEnter(object sender, DragEventArgs e)
	{
		e.Effect = DragDropEffects.Move;
		btnConestado();
	}

	public static void SetDoubleBuffered(Control c)
	{
		if (!SystemInformation.TerminalServerSession)
		{
			typeof(Control).GetProperty("DoubleBuffered", BindingFlags.Instance | BindingFlags.NonPublic).SetValue(c, true, null);
		}
	}

	private void CargarPanel(Pregunta P)
	{
		try
		{
			controlesParaPanel = new List<Control>();
			int num = 0;
			int num2 = 0;
			int num3 = 0;
			Color white = Color.White;
			double num4 = 0.0;
			if (p.Estatus == 0 || p.Estatus == 2)
			{
				P.Opciones.Shuffle();
				if (P.TipoPregunta == eTipoPregunta.Ordenamiento && !P.Opciones.Select((Opcion q) => q.Orden).ToList().Select((int i, int j) => i - j)
					.Distinct()
					.Skip(1)
					.Any())
				{
					P.Opciones.Shuffle();
				}
			}
			switch (P.TipoPregunta)
			{
			case eTipoPregunta.OpcionMultiple:
			{
				int num6 = pnlOpcionMultiple.Size.Height;
				num = pnlOpcionMultiple.Size.Width;
				num2 = int.Parse(Math.Round((double)num6 / (double)p.Opciones.Count, MidpointRounding.AwayFromZero).ToString());
				num3 = num2;
				skinImage1.Scheme = Schemes.MacOs;
				updatecontrols();
				int num7 = 0;
				{
					foreach (Opcion opcione in P.Opciones)
					{
						SkinRadioButton skinRadioButton = new SkinRadioButton();
						skinRadioButton.Font = new System.Drawing.Font("Segoe UI", 14f, FontStyle.Regular);
						skinRadioButton.BackColor = Color.Transparent;
						skinRadioButton.ForeColor = white;
						skinRadioButton.Value = opcione.OpcionId;
						skinRadioButton.Text = opcione.Texto;
						skinRadioButton.Height = 100;
						skinRadioButton.Width = num - 20;
						skinRadioButton.AutoSize = false;
						skinRadioButton.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right;
						skinRadioButton.TextAlign = ContentAlignment.MiddleLeft;
						skinRadioButton.CheckedChanged += radiobutton_checked;
						if (opcione.Seleccionada)
						{
							skinRadioButton.Checked = true;
						}
						int num8 = 17;
						num2 = num3 * P.Opciones.IndexOf(opcione);
						_ = num3 / 2;
						num7 += num3;
						skinRadioButton.Location = new Point(10, num2);
						controlesParaPanel.Add(skinRadioButton);
					}
					break;
				}
			}
			case eTipoPregunta.SeleccionMultiple:
			{
				int num5 = pnlSeleccionMultiple.Size.Height;
				num = pnlSeleccionMultiple.Size.Width;
				num2 = int.Parse(Math.Round((double)num5 / (double)p.Opciones.Count, MidpointRounding.AwayFromZero).ToString());
				num3 = num2;
				white = Color.FromArgb(50, 255, 255, 255);
				{
					foreach (Opcion opcione2 in P.Opciones)
					{
						CheckBoxEduIT checkBoxEduIT = new CheckBoxEduIT();
						checkBoxEduIT.Font = new System.Drawing.Font("Segoe UI", 14f, FontStyle.Regular);
						checkBoxEduIT.Value = opcione2.OpcionId;
						checkBoxEduIT.Text = opcione2.Texto;
						checkBoxEduIT.Height = num3;
						checkBoxEduIT.Width = num;
						checkBoxEduIT.AutoSize = false;
						checkBoxEduIT.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right;
						checkBoxEduIT.TextAlign = ContentAlignment.MiddleLeft;
						checkBoxEduIT.BackColor = white;
						checkBoxEduIT.CheckedChanged += OnCheck;
						if (opcione2.Seleccionada)
						{
							checkBoxEduIT.Checked = true;
						}
						white = ((!(white == Color.FromArgb(50, 255, 255, 255))) ? Color.FromArgb(50, 255, 255, 255) : Color.FromArgb(0, 255, 255, 255));
						num2 = num3 * P.Opciones.IndexOf(opcione2);
						checkBoxEduIT.Location = new Point(0, num2);
						controlesParaPanel.Add(checkBoxEduIT);
					}
					break;
				}
			}
			case eTipoPregunta.ArrastrarSoltar:
			{
				Size size3 = new Size(pnlOrigenArrastrarSoltar.Width, pnlOrigenArrastrarSoltar.Height / p.Opciones.Count);
				pnlOrigenArrastrarSoltar.DragEnter += flpArrastrarSoltar_DragEnter;
				pnlOrigenArrastrarSoltar.DragDrop += flpArrastrarSoltar_DragDrop;
				pnlDestinoArrastrarSoltar.DragEnter += flpArrastrarSoltar_DragEnter;
				pnlDestinoArrastrarSoltar.DragDrop += flpArrastrarSoltar_DragDrop;
				foreach (Opcion item in from m in P.Opciones
					where !m.Seleccionada
					orderby m.OrdenSeleccionado
					select m)
				{
					HarrProgressBar harrProgressBar4 = new HarrProgressBar();
					harrProgressBar4.Font = new System.Drawing.Font("Segoe UI", 14f, FontStyle.Regular);
					harrProgressBar4.Padding = new Padding(5);
					harrProgressBar4.OpcionId = item.OpcionId;
					harrProgressBar4.PreguntaId = item.PreguntaId;
					harrProgressBar4.Orden = item.Orden;
					harrProgressBar4.PreguntaId = item.PreguntaId;
					harrProgressBar4.LeftBarSize = 0;
					harrProgressBar4.MainText = item.Texto;
					harrProgressBar4.FillDegree = 100;
					harrProgressBar4.RightBarSize = 0;
					harrProgressBar4.StatusBarSize = 0;
					harrProgressBar4.StatusBarColor = 0;
					harrProgressBar4.Size = size3;
					harrProgressBar4.Anchor = AnchorStyles.Left | AnchorStyles.Right;
					if (File.Exists(Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/indicaciones_examen.png")))
					{
						harrProgressBar4.BackgroundImage = System.Drawing.Image.FromFile(Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/indicaciones_examen.png"));
					}
					else
					{
						harrProgressBar4.BackgroundImage = Resources.indicacionesexamen;
					}
					controlesParaPanel.Add(harrProgressBar4);
				}
				{
					foreach (Opcion item2 in from m in P.Opciones
						where m.Seleccionada
						orderby m.OrdenSeleccionado
						select m)
					{
						HarrProgressBar harrProgressBar5 = new HarrProgressBar();
						harrProgressBar5.Font = new System.Drawing.Font("Segoe UI", 14f, FontStyle.Regular);
						harrProgressBar5.Padding = new Padding(5);
						harrProgressBar5.OpcionId = item2.OpcionId;
						harrProgressBar5.PreguntaId = item2.PreguntaId;
						harrProgressBar5.Orden = item2.Orden;
						harrProgressBar5.PreguntaId = item2.PreguntaId;
						harrProgressBar5.LeftBarSize = 0;
						harrProgressBar5.MainText = item2.Texto;
						harrProgressBar5.FillDegree = 100;
						harrProgressBar5.RightBarSize = 0;
						harrProgressBar5.StatusBarSize = 0;
						harrProgressBar5.StatusBarColor = 0;
						harrProgressBar5.Size = size3;
						harrProgressBar5.Anchor = AnchorStyles.Left | AnchorStyles.Right;
						if (File.Exists(Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/indicaciones_examen.png")))
						{
							harrProgressBar5.BackgroundImage = System.Drawing.Image.FromFile(Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/indicaciones_examen.png"));
						}
						else
						{
							harrProgressBar5.BackgroundImage = Resources.indicacionesexamen;
						}
						controlesParaPanel2.Add(harrProgressBar5);
					}
					break;
				}
			}
			case eTipoPregunta.Ordenamiento:
			{
				Size size2 = new Size(flpOrdenamiento.Width, flpOrdenamiento.Height / p.Opciones.Count);
				flpOrdenamiento.DragEnter += flpOrdenamiento_DragEnter;
				flpOrdenamiento.DragDrop += flpOrdenamiento_DragDrop;
				{
					foreach (Opcion item3 in P.Opciones.OrderBy((Opcion m) => m.OrdenSeleccionado))
					{
						HarrProgressBar harrProgressBar3 = new HarrProgressBar();
						harrProgressBar3.Font = new System.Drawing.Font("Segoe UI", 14f, FontStyle.Regular);
						harrProgressBar3.Padding = new Padding(5);
						harrProgressBar3.OpcionId = item3.OpcionId;
						harrProgressBar3.PreguntaId = item3.PreguntaId;
						harrProgressBar3.Orden = item3.Orden;
						harrProgressBar3.PreguntaId = item3.PreguntaId;
						harrProgressBar3.LeftBarSize = 0;
						harrProgressBar3.MainText = item3.Texto;
						harrProgressBar3.FillDegree = 100;
						harrProgressBar3.RightBarSize = 0;
						harrProgressBar3.StatusBarSize = 0;
						harrProgressBar3.StatusBarColor = 0;
						harrProgressBar3.Size = size2;
						harrProgressBar3.Anchor = AnchorStyles.Left | AnchorStyles.Right;
						if (File.Exists(Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/indicaciones_examen.png")))
						{
							harrProgressBar3.BackgroundImage = System.Drawing.Image.FromFile(Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/indicaciones_examen.png"));
						}
						else
						{
							harrProgressBar3.BackgroundImage = Resources.indicacionesexamen;
						}
						flpOrdenamiento.Controls.Add(harrProgressBar3);
					}
					break;
				}
			}
			case eTipoPregunta.TrueFalse:
			{
				int num9 = pnlSeleccionMultiple.Size.Height;
				num = pnlSeleccionMultiple.Size.Width;
				num2 = int.Parse(Math.Round((double)num9 / (double)p.Opciones.Count, MidpointRounding.AwayFromZero).ToString());
				num3 = num2;
				_ = Color.Gray;
				{
					foreach (Opcion opcione3 in P.Opciones)
					{
						PanelEduIT panelEduIT = new PanelEduIT();
						panelEduIT.Font = new System.Drawing.Font("Segoe UI", 14f, FontStyle.Regular);
						panelEduIT.BorderStyle = BorderStyle.None;
						panelEduIT.Height = num3;
						panelEduIT.BackColor = Color.Transparent;
						num2 = num3 * P.Opciones.IndexOf(opcione3);
						panelEduIT.Location = new Point(0, num2);
						panelEduIT.Width = num;
						panelEduIT.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right;
						Label label = new Label();
						label.Font = new System.Drawing.Font("Segoe UI", 14f, FontStyle.Regular);
						label.ForeColor = Color.White;
						label.AutoSize = false;
						label.Width = 150;
						label.Height = panelEduIT.Height;
						label.Text = (opcione3.Texto.Trim().ToUpper().EsAlguno("TRUE", "VERDADERO") ? "VERDADERO" : "FALSO");
						label.Location = new Point(120, 20);
						panelEduIT.Value = opcione3.OpcionId;
						panelEduIT.Controls.Add(label);
						ToggleButton toggleButton = new ToggleButton();
						toggleButton.Font = new System.Drawing.Font("Segoe UI", 14f, FontStyle.Regular);
						toggleButton.Value = opcione3.OpcionId;
						toggleButton.SliderColor = Color.Blue;
						toggleButton.ToggleStyle = ToggleButton.ToggleButtonStyle.Windows;
						toggleButton.ActiveText = "True";
						toggleButton.ActiveColor = Color.FromArgb(27, 161, 226);
						toggleButton.ActiveText = "ON";
						toggleButton.Anchor = AnchorStyles.Top | AnchorStyles.Right;
						toggleButton.BackColor = Color.White;
						toggleButton.InActiveColor = Color.FromArgb(70, 70, 70);
						toggleButton.InActiveText = "OFF";
						toggleButton.Location = new Point(10, 20);
						toggleButton.MaximumSize = new Size(119, 32);
						toggleButton.MinimumSize = new Size(65, 23);
						toggleButton.Name = "tbTF1";
						toggleButton.Size = new Size(80, 23);
						toggleButton.SliderColor = Color.Black;
						toggleButton.SlidingAngle = 8;
						toggleButton.TabIndex = 2;
						toggleButton.Text = "toggleButton1";
						toggleButton.TextColor = Color.White;
						if (opcione3.Seleccionada)
						{
							toggleButton.ToggleState = ToggleButton.ToggleButtonState.ON;
						}
						else
						{
							toggleButton.ToggleState = ToggleButton.ToggleButtonState.OFF;
						}
						toggleButton.ToggleStyle = ToggleButton.ToggleButtonStyle.Windows;
						toggleButton.ButtonStateChanged += OnCheckTrueFalse;
						panelEduIT.Controls.Add(toggleButton);
						controlesParaPanel.Add(panelEduIT);
					}
					break;
				}
			}
			case eTipoPregunta.OrdenarPanelDragDrop:
			{
				Size size = new Size(pnlOrigenArrastrarOrdenar.Width, pnlOrigenArrastrarOrdenar.Height / p.Opciones.Count);
				pnlOrigenArrastrarOrdenar.DragEnter += ArrastrarOrdenar_DragEnter;
				pnlOrigenArrastrarOrdenar.DragDrop += ArrastrarOrdenar_DragDrop;
				pnlDestinoArrastrarOrdenar.DragEnter += ArrastrarOrdenar_DragEnter;
				pnlDestinoArrastrarOrdenar.DragDrop += ArrastrarOrdenar_DragDrop;
				foreach (Opcion item4 in from m in P.Opciones
					where !m.Seleccionada
					orderby m.OrdenSeleccionado
					select m)
				{
					HarrProgressBar harrProgressBar = new HarrProgressBar();
					harrProgressBar.Font = new System.Drawing.Font("Segoe UI", 14f, FontStyle.Regular);
					harrProgressBar.Padding = new Padding(5);
					harrProgressBar.OpcionId = item4.OpcionId;
					harrProgressBar.PreguntaId = item4.PreguntaId;
					harrProgressBar.Orden = item4.Orden;
					harrProgressBar.PreguntaId = item4.PreguntaId;
					harrProgressBar.LeftBarSize = 0;
					harrProgressBar.MainText = item4.Texto;
					harrProgressBar.FillDegree = 100;
					harrProgressBar.RightBarSize = 0;
					harrProgressBar.StatusBarSize = 0;
					harrProgressBar.StatusBarColor = 0;
					harrProgressBar.Size = size;
					harrProgressBar.Anchor = AnchorStyles.Left | AnchorStyles.Right;
					if (File.Exists(Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/indicaciones_examen.png")))
					{
						harrProgressBar.BackgroundImage = System.Drawing.Image.FromFile(Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/indicaciones_examen.png"));
					}
					else
					{
						harrProgressBar.BackgroundImage = Resources.indicacionesexamen;
					}
					controlesParaPanel.Add(harrProgressBar);
				}
				{
					foreach (Opcion item5 in from m in P.Opciones
						where m.Seleccionada
						orderby m.OrdenSeleccionado
						select m)
					{
						HarrProgressBar harrProgressBar2 = new HarrProgressBar();
						harrProgressBar2.Font = new System.Drawing.Font("Segoe UI", 14f, FontStyle.Regular);
						harrProgressBar2.Padding = new Padding(5);
						harrProgressBar2.OpcionId = item5.OpcionId;
						harrProgressBar2.PreguntaId = item5.PreguntaId;
						harrProgressBar2.Orden = item5.Orden;
						harrProgressBar2.PreguntaId = item5.PreguntaId;
						harrProgressBar2.LeftBarSize = 0;
						harrProgressBar2.MainText = item5.Texto;
						harrProgressBar2.FillDegree = 100;
						harrProgressBar2.RightBarSize = 0;
						harrProgressBar2.StatusBarSize = 0;
						harrProgressBar2.StatusBarColor = 0;
						harrProgressBar2.Size = size;
						harrProgressBar2.Anchor = AnchorStyles.Left | AnchorStyles.Right;
						if (File.Exists(Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/indicaciones_examen.png")))
						{
							harrProgressBar2.BackgroundImage = System.Drawing.Image.FromFile(Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/indicaciones_examen.png"));
						}
						else
						{
							harrProgressBar2.BackgroundImage = Resources.indicacionesexamen;
						}
						controlesParaPanel2.Add(harrProgressBar2);
					}
					break;
				}
			}
			}
		}
		catch (Exception ex)
		{
			MessageBox.Show(ex.Message);
		}
	}

	private void CargarPanel2(Pregunta P)
	{
		try
		{
			controlesParaPanel = new List<Control>();
			int num = 0;
			int num2 = 0;
			int num3 = 0;
			Color white = Color.White;
			double num4 = 0.0;
			if (p.Estatus == 0 || p.Estatus == 2)
			{
				P.Opciones.Shuffle();
				if (P.TipoPregunta == eTipoPregunta.Ordenamiento && !P.Opciones.Select((Opcion q) => q.Orden).ToList().Select((int i, int j) => i - j)
					.Distinct()
					.Skip(1)
					.Any())
				{
					P.Opciones.Shuffle();
				}
				if (evaluaasi.Preguntas.Where((Pregunta m) => m.Estatus < 2).Count() == 1)
				{
					btnOmitir.Visible = false;
				}
				else
				{
					btnOmitir.Visible = true;
				}
			}
			else
			{
				btnOmitir.Visible = false;
			}
			switch (P.TipoPregunta)
			{
			case eTipoPregunta.OpcionMultiple:
			{
				BooleanExtensions.IniciarPanel(visible: true, ref pnlOpcionMultiple);
				pnlOpcionMultiple.Controls.Clear();
				int num6 = pnlOpcionMultiple.Size.Height;
				num = pnlOpcionMultiple.Size.Width;
				num2 = int.Parse(Math.Round((double)num6 / (double)p.Opciones.Count, MidpointRounding.AwayFromZero).ToString());
				num3 = num2;
				skinImage1.Scheme = Schemes.MacOs;
				updatecontrols();
				int num7 = 0;
				{
					foreach (Opcion opcione in P.Opciones)
					{
						SkinRadioButton skinRadioButton = new SkinRadioButton();
						skinRadioButton.Font = new System.Drawing.Font("Segoe UI", 14f, FontStyle.Regular);
						skinRadioButton.BackColor = Color.Transparent;
						skinRadioButton.ForeColor = white;
						skinRadioButton.Value = opcione.OpcionId;
						skinRadioButton.Text = opcione.Texto;
						skinRadioButton.Height = 100;
						skinRadioButton.Width = num - 20;
						skinRadioButton.AutoSize = false;
						skinRadioButton.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right;
						skinRadioButton.TextAlign = ContentAlignment.MiddleLeft;
						skinRadioButton.CheckedChanged += radiobutton_checked;
						int num8 = 17;
						num2 = num3 * P.Opciones.IndexOf(opcione);
						_ = num3 / 2;
						num7 += num3;
						skinRadioButton.Location = new Point(10, num2);
						pnlOpcionMultiple.Controls.Add(skinRadioButton);
					}
					break;
				}
			}
			case eTipoPregunta.SeleccionMultiple:
			{
				BooleanExtensions.IniciarPanel(visible: true, ref pnlSeleccionMultiple);
				pnlSeleccionMultiple.Controls.Clear();
				int num11 = pnlSeleccionMultiple.Size.Height;
				num = pnlSeleccionMultiple.Size.Width;
				num2 = int.Parse(Math.Round((double)num11 / (double)p.Opciones.Count, MidpointRounding.AwayFromZero).ToString());
				num3 = num2;
				white = Color.FromArgb(50, 255, 255, 255);
				{
					foreach (Opcion opcione2 in P.Opciones)
					{
						CheckBoxEduIT checkBoxEduIT = new CheckBoxEduIT();
						checkBoxEduIT.Font = new System.Drawing.Font("Segoe UI", 14f, FontStyle.Regular);
						checkBoxEduIT.Value = opcione2.OpcionId;
						checkBoxEduIT.Text = opcione2.Texto;
						checkBoxEduIT.Height = num3;
						checkBoxEduIT.Width = num;
						checkBoxEduIT.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right;
						checkBoxEduIT.TextAlign = ContentAlignment.MiddleLeft;
						checkBoxEduIT.BackColor = white;
						checkBoxEduIT.CheckedChanged += OnCheck;
						if (opcione2.Seleccionada)
						{
							checkBoxEduIT.Checked = true;
						}
						white = ((!(white == Color.FromArgb(50, 255, 255, 255))) ? Color.FromArgb(50, 255, 255, 255) : Color.FromArgb(0, 255, 255, 255));
						num2 = num3 * P.Opciones.IndexOf(opcione2);
						checkBoxEduIT.Location = new Point(0, num2);
						pnlSeleccionMultiple.Controls.Add(checkBoxEduIT);
					}
					break;
				}
			}
			case eTipoPregunta.ArrastrarSoltar:
			{
				BooleanExtensions.IniciarPanel(visible: true, ref pnlDragDrop);
				num = pnlDragDrop.Size.Width;
				int num9 = (int)Math.Round((decimal)(num / 2), MidpointRounding.AwayFromZero) - 20;
				pnlOrigenArrastrarSoltar.Width = num9;
				pnlDestinoArrastrarSoltar.Width = num9;
				pnlDestinoArrastrarSoltar.Location = new Point(num9 + 30, 17);
				Size size2 = new Size(pnlOrigenArrastrarSoltar.Width, pnlOrigenArrastrarSoltar.Height / p.Opciones.Count);
				pnlOrigenArrastrarSoltar.Controls.Clear();
				pnlDestinoArrastrarSoltar.Controls.Clear();
				pnlOrigenArrastrarSoltar.DragEnter += flpArrastrarSoltar_DragEnter;
				pnlOrigenArrastrarSoltar.DragDrop += flpArrastrarSoltar_DragDrop;
				pnlDestinoArrastrarSoltar.DragEnter += flpArrastrarSoltar_DragEnter;
				pnlDestinoArrastrarSoltar.DragDrop += flpArrastrarSoltar_DragDrop;
				foreach (Opcion item in from m in P.Opciones
					where !m.Seleccionada
					orderby m.OrdenSeleccionado
					select m)
				{
					HarrProgressBar harrProgressBar3 = new HarrProgressBar();
					harrProgressBar3.Font = new System.Drawing.Font("Segoe UI", 14f, FontStyle.Regular);
					harrProgressBar3.Padding = new Padding(5);
					harrProgressBar3.OpcionId = item.OpcionId;
					harrProgressBar3.PreguntaId = item.PreguntaId;
					harrProgressBar3.Orden = item.Orden;
					harrProgressBar3.PreguntaId = item.PreguntaId;
					harrProgressBar3.LeftBarSize = 0;
					harrProgressBar3.MainText = item.Texto;
					harrProgressBar3.FillDegree = 100;
					harrProgressBar3.RightBarSize = 0;
					harrProgressBar3.StatusBarSize = 0;
					harrProgressBar3.StatusBarColor = 0;
					harrProgressBar3.Size = size2;
					harrProgressBar3.Anchor = AnchorStyles.Left | AnchorStyles.Right;
					if (File.Exists(Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/indicaciones_examen.png")))
					{
						harrProgressBar3.BackgroundImage = System.Drawing.Image.FromFile(Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/indicaciones_examen.png"));
					}
					else
					{
						harrProgressBar3.BackgroundImage = Resources.indicacionesexamen;
					}
					pnlOrigenArrastrarSoltar.Controls.Add(harrProgressBar3);
				}
				{
					foreach (Opcion item2 in from m in P.Opciones
						where m.Seleccionada
						orderby m.OrdenSeleccionado
						select m)
					{
						HarrProgressBar harrProgressBar4 = new HarrProgressBar();
						harrProgressBar4.Font = new System.Drawing.Font("Segoe UI", 14f, FontStyle.Regular);
						harrProgressBar4.Padding = new Padding(5);
						harrProgressBar4.OpcionId = item2.OpcionId;
						harrProgressBar4.PreguntaId = item2.PreguntaId;
						harrProgressBar4.Orden = item2.Orden;
						harrProgressBar4.PreguntaId = item2.PreguntaId;
						harrProgressBar4.LeftBarSize = 0;
						harrProgressBar4.MainText = item2.Texto;
						harrProgressBar4.FillDegree = 100;
						harrProgressBar4.RightBarSize = 0;
						harrProgressBar4.StatusBarSize = 0;
						harrProgressBar4.StatusBarColor = 0;
						harrProgressBar4.Size = size2;
						harrProgressBar4.Anchor = AnchorStyles.Left | AnchorStyles.Right;
						if (File.Exists(Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/indicaciones_examen.png")))
						{
							harrProgressBar4.BackgroundImage = System.Drawing.Image.FromFile(Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/indicaciones_examen.png"));
						}
						else
						{
							harrProgressBar4.BackgroundImage = Resources.indicacionesexamen;
						}
						pnlDestinoArrastrarSoltar.Controls.Add(harrProgressBar4);
					}
					break;
				}
			}
			case eTipoPregunta.Ordenamiento:
			{
				BooleanExtensions.IniciarPanel(visible: true, ref PnlDragDropPanels);
				Size size3 = new Size(flpOrdenamiento.Width, flpOrdenamiento.Height / p.Opciones.Count);
				flpOrdenamiento.Controls.Clear();
				flpOrdenamiento.DragEnter += flpOrdenamiento_DragEnter;
				flpOrdenamiento.DragDrop += flpOrdenamiento_DragDrop;
				{
					foreach (Opcion item3 in P.Opciones.OrderBy((Opcion m) => m.OrdenSeleccionado))
					{
						HarrProgressBar harrProgressBar5 = new HarrProgressBar();
						harrProgressBar5.Font = new System.Drawing.Font("Segoe UI", 14f, FontStyle.Regular);
						harrProgressBar5.Padding = new Padding(5);
						harrProgressBar5.OpcionId = item3.OpcionId;
						harrProgressBar5.PreguntaId = item3.PreguntaId;
						harrProgressBar5.Orden = item3.Orden;
						harrProgressBar5.PreguntaId = item3.PreguntaId;
						harrProgressBar5.LeftBarSize = 0;
						harrProgressBar5.MainText = item3.Texto;
						harrProgressBar5.FillDegree = 100;
						harrProgressBar5.RightBarSize = 0;
						harrProgressBar5.StatusBarSize = 0;
						harrProgressBar5.StatusBarColor = 0;
						harrProgressBar5.Size = size3;
						harrProgressBar5.Anchor = AnchorStyles.Left | AnchorStyles.Right;
						if (File.Exists(Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/indicaciones_examen.png")))
						{
							harrProgressBar5.BackgroundImage = System.Drawing.Image.FromFile(Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/indicaciones_examen.png"));
						}
						else
						{
							harrProgressBar5.BackgroundImage = Resources.indicacionesexamen;
						}
						flpOrdenamiento.Controls.Add(harrProgressBar5);
					}
					break;
				}
			}
			case eTipoPregunta.TrueFalse:
			{
				BooleanExtensions.IniciarPanel(visible: true, ref pnlSeleccionMultiple);
				pnlSeleccionMultiple.Controls.Clear();
				int num10 = pnlSeleccionMultiple.Size.Height;
				num = pnlSeleccionMultiple.Size.Width;
				num2 = int.Parse(Math.Round((double)num10 / (double)p.Opciones.Count, MidpointRounding.AwayFromZero).ToString());
				num3 = num2;
				_ = Color.Gray;
				{
					foreach (Opcion opcione3 in P.Opciones)
					{
						PanelEduIT panelEduIT = new PanelEduIT();
						panelEduIT.Font = new System.Drawing.Font("Segoe UI", 14f, FontStyle.Regular);
						panelEduIT.BorderStyle = BorderStyle.None;
						panelEduIT.Height = num3;
						panelEduIT.BackColor = Color.Transparent;
						num2 = num3 * P.Opciones.IndexOf(opcione3);
						panelEduIT.Width = num;
						panelEduIT.Location = new Point(0, num2);
						panelEduIT.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right;
						Label label = new Label();
						label.Font = new System.Drawing.Font("Segoe UI", 14f, FontStyle.Regular);
						label.ForeColor = Color.White;
						label.AutoSize = false;
						label.Width = 150;
						label.Height = panelEduIT.Height;
						label.Text = (opcione3.Texto.Trim().ToUpper().EsAlguno("TRUE", "VERDADERO") ? "VERDADERO" : "FALSO");
						label.Location = new Point(120, 20);
						panelEduIT.Value = opcione3.OpcionId;
						panelEduIT.Controls.Add(label);
						ToggleButton toggleButton = new ToggleButton();
						toggleButton.Font = new System.Drawing.Font("Segoe UI", 14f, FontStyle.Regular);
						toggleButton.Value = opcione3.OpcionId;
						toggleButton.SliderColor = Color.Blue;
						toggleButton.ToggleStyle = ToggleButton.ToggleButtonStyle.Windows;
						toggleButton.ActiveText = "True";
						toggleButton.ActiveColor = Color.FromArgb(27, 161, 226);
						toggleButton.ActiveText = "ON";
						toggleButton.Anchor = AnchorStyles.Top | AnchorStyles.Right;
						toggleButton.BackColor = Color.White;
						toggleButton.InActiveColor = Color.FromArgb(70, 70, 70);
						toggleButton.InActiveText = "OFF";
						toggleButton.Location = new Point(10, 20);
						toggleButton.MaximumSize = new Size(119, 32);
						toggleButton.MinimumSize = new Size(65, 23);
						toggleButton.Name = "tbTF1";
						toggleButton.Size = new Size(80, 23);
						toggleButton.SliderColor = Color.Black;
						toggleButton.SlidingAngle = 8;
						toggleButton.TabIndex = 2;
						toggleButton.Text = "toggleButton1";
						toggleButton.TextColor = Color.White;
						if (opcione3.Seleccionada)
						{
							toggleButton.ToggleState = ToggleButton.ToggleButtonState.ON;
						}
						else
						{
							toggleButton.ToggleState = ToggleButton.ToggleButtonState.OFF;
						}
						toggleButton.ToggleStyle = ToggleButton.ToggleButtonStyle.Windows;
						toggleButton.ButtonStateChanged += OnCheckTrueFalse;
						panelEduIT.Controls.Add(toggleButton);
						SetDoubleBuffered(panelEduIT);
						pnlSeleccionMultiple.Controls.Add(panelEduIT);
					}
					break;
				}
			}
			case eTipoPregunta.OrdenarPanelDragDrop:
			{
				BooleanExtensions.IniciarPanel(visible: true, ref pnlArrastraOrdena);
				int num5 = (int)Math.Round((decimal)(pnlArrastraOrdena.Size.Width / 2), MidpointRounding.AwayFromZero) - 20;
				pnlOrigenArrastrarOrdenar.Width = num5;
				pnlDestinoArrastrarOrdenar.Width = num5;
				pnlDestinoArrastrarOrdenar.Location = new Point(num5 + 30, 17);
				Size size = new Size(pnlOrigenArrastrarOrdenar.Width, pnlOrigenArrastrarOrdenar.Height / p.Opciones.Count);
				pnlOrigenArrastrarOrdenar.Controls.Clear();
				pnlDestinoArrastrarOrdenar.Controls.Clear();
				pnlOrigenArrastrarOrdenar.DragEnter += ArrastrarOrdenar_DragEnter;
				pnlOrigenArrastrarOrdenar.DragDrop += ArrastrarOrdenar_DragDrop;
				pnlDestinoArrastrarOrdenar.DragEnter += ArrastrarOrdenar_DragEnter;
				pnlDestinoArrastrarOrdenar.DragDrop += ArrastrarOrdenar_DragDrop;
				foreach (Opcion item4 in P.Opciones.Where((Opcion m) => !m.Seleccionada))
				{
					HarrProgressBar harrProgressBar = new HarrProgressBar();
					harrProgressBar.Font = new System.Drawing.Font("Segoe UI", 14f, FontStyle.Regular);
					harrProgressBar.Padding = new Padding(5);
					harrProgressBar.OpcionId = item4.OpcionId;
					harrProgressBar.PreguntaId = item4.PreguntaId;
					harrProgressBar.Orden = item4.Orden;
					harrProgressBar.PreguntaId = item4.PreguntaId;
					harrProgressBar.LeftBarSize = 0;
					harrProgressBar.MainText = item4.Texto;
					harrProgressBar.FillDegree = 100;
					harrProgressBar.RightBarSize = 0;
					harrProgressBar.StatusBarSize = 0;
					harrProgressBar.StatusBarColor = 0;
					harrProgressBar.Size = size;
					harrProgressBar.Anchor = AnchorStyles.Left | AnchorStyles.Right;
					if (File.Exists(Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/indicaciones_examen.png")))
					{
						harrProgressBar.BackgroundImage = System.Drawing.Image.FromFile(Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/indicaciones_examen.png"));
					}
					else
					{
						harrProgressBar.BackgroundImage = Resources.indicacionesexamen;
					}
					pnlOrigenArrastrarOrdenar.Controls.Add(harrProgressBar);
				}
				{
					foreach (Opcion item5 in from m in P.Opciones
						where m.Seleccionada
						orderby m.OrdenSeleccionado
						select m)
					{
						HarrProgressBar harrProgressBar2 = new HarrProgressBar();
						harrProgressBar2.Font = new System.Drawing.Font("Segoe UI", 14f, FontStyle.Regular);
						harrProgressBar2.Padding = new Padding(5);
						harrProgressBar2.OpcionId = item5.OpcionId;
						harrProgressBar2.PreguntaId = item5.PreguntaId;
						harrProgressBar2.Orden = item5.Orden;
						harrProgressBar2.PreguntaId = item5.PreguntaId;
						harrProgressBar2.LeftBarSize = 0;
						harrProgressBar2.MainText = item5.Texto;
						harrProgressBar2.FillDegree = 100;
						harrProgressBar2.RightBarSize = 0;
						harrProgressBar2.StatusBarSize = 0;
						harrProgressBar2.StatusBarColor = 0;
						harrProgressBar2.Size = size;
						harrProgressBar2.Anchor = AnchorStyles.Left | AnchorStyles.Right;
						if (File.Exists(Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/indicaciones_examen.png")))
						{
							harrProgressBar2.BackgroundImage = System.Drawing.Image.FromFile(Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/indicaciones_examen.png"));
						}
						else
						{
							harrProgressBar2.BackgroundImage = Resources.indicacionesexamen;
						}
						pnlDestinoArrastrarOrdenar.Controls.Add(harrProgressBar2);
					}
					break;
				}
			}
			}
		}
		catch (Exception ex)
		{
			MessageBox.Show(ex.Message);
		}
	}

	private void OcultarPaneles(bool visible)
	{
		visible.IniciarPanel(ref pnlSeleccionMultiple);
		visible.IniciarPanel(ref pnlDragDrop);
		visible.IniciarPanel(ref PnlDragDropPanels);
	}

	private void btnConestado()
	{
		p.Estatus = 2;
		p.FechaRespuesta = DateTime.Now;
		evaluaasi.Preguntas.Where((Pregunta m) => m.PreguntaId == p.PreguntaId).First().Estatus = 2;
	}

	private void OnClickButton1(object sender, EventArgs e)
	{
		bActual.BackColor = Color.Black;
		bActual.ForeColor = Color.White;
		Button b = (Button)sender;
		p = evaluaasi.Preguntas.Where((Pregunta m) => m.PreguntaId == int.Parse(b.Name)).First();
		lblTextoPregunta.Text = p.Texto;
		bgwCargarPregunta.RunWorkerAsync();
	}

	private void label10_Click(object sender, EventArgs e)
	{
	}

	private void tmr_Tick(object sender, EventArgs e)
	{
		if (segundos2 > 0)
		{
			segundos2--;
		}
		else if (segundos2 == 0)
		{
			minutos--;
			segundos2 = 59;
		}
		if (segundos2 == 0 && minutos == 0)
		{
			tmr.Stop();
			Question question = new Question();
			string text = "";
			question.lblTitulo.Text = "Evaluaasi";
			text = "Ha finalizado el tiempo para resolver el examen, se evaluarán las preguntas que hayas respondido, a continuación se mostrará tu resultado." + Environment.NewLine + Environment.NewLine + "En la ventana de resultado, podrás hacer zoom a la vista preliminar del archivo de resultado utilizando la barra inferior.";
			question.Height = 250;
			question.lblDetalle.Text = text;
			question.btnSi.Visible = false;
			question.btnNo.Visible = false;
			question.ShowDialog();
			FinalizarExamen();
		}
		else
		{
			lblMinutos.Text = minutos.PonerCeros(2) + ":" + segundos2.PonerCeros(2);
		}
	}

	private void FinalizarExamen()
	{
		pbSpinner.Image = Resources.spn3;
		pbSpinner.Visible = true;
		pbSpinner.SizeMode = PictureBoxSizeMode.CenterImage;
		pbSpinner.BringToFront();
		bgwFinalizar.RunWorkerAsync();
	}

	public System.Drawing.Image GenerarQR(string cadena)
	{
		QrCode qrCode = new QrEncoder(ErrorCorrectionLevel.H).Encode(cadena);
		MemoryStream stream = new MemoryStream();
		new GraphicsRenderer(new FixedModuleSize(5, QuietZoneModules.Two), Brushes.Gray, Brushes.White).WriteToStream(qrCode.Matrix, ImageFormat.Png, stream);
		return System.Drawing.Image.FromStream(stream);
	}

	private void updatecontrols()
	{
		foreach (Control control in base.Controls)
		{
			control.Invalidate();
		}
	}

	public void EnableDoubleBuffering()
	{
		SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.DoubleBuffer, value: true);
		UpdateStyles();
	}

	private void bgwFinalizar_DoWork(object sender, DoWorkEventArgs e)
	{
		string text = "Fuera de línea";
		if (fechaEnLinea)
		{
			if (new Helper().Conexion())
			{
				try
				{
					using UsuarioSoapClient usuarioSoapClient = new UsuarioSoapClient();
					FechaFin = DateTime.FromOADate(usuarioSoapClient.Fecha());
				}
				catch (Exception)
				{
					FechaFin = DateTime.Now;
				}
			}
			else
			{
				FechaFin = DateTime.Now;
			}
		}
		else
		{
			FechaFin = DateTime.Now;
		}
		foreach (Categoria categoria in evaluaasi.Categorias)
		{
			foreach (Tema t in categoria.Temas)
			{
				t.Preguntas = evaluaasi.Preguntas.Where((Pregunta m) => m.TemaId == t.TemaId).ToList();
				t.Correctas = t.Preguntas.Where((Pregunta m) => m.Correcta == "true").Count();
				if (t.Preguntas.Count == t.Correctas && t.Preguntas.Count > 0)
				{
					t.Calificacion = (decimal)categoria.Porcentaje / (decimal)categoria.Temas.Count();
				}
				else if (t.Correctas > 0)
				{
					decimal num = (decimal)categoria.Porcentaje / (decimal)categoria.Temas.Count() / (decimal)t.Preguntas.Count;
					t.Calificacion = (decimal)t.Correctas * num;
				}
				else
				{
					t.Calificacion = 0m;
				}
			}
			categoria.Calificacion = categoria.Temas.Sum((Tema m) => m.Calificacion);
		}
		calificacion = (int)evaluaasi.Categorias.Sum((Categoria m) => m.Calificacion) * 10;
		string text2 = "";
		cabecera = $"{V.VoucherId.ToString()}|{V.VoucherCode}|{User.Nombre} {User.Apellido}|{User.SubSistema}|";
		"Solicitud de finalización a servicio                      ".Bitacora("000008", "Examen", "Fin   ", "000890", "000010");
		if (new Helper().Conexion())
		{
			try
			{
				using UsuarioSoapClient usuarioSoapClient2 = new UsuarioSoapClient();
				text = usuarioSoapClient2.Fin(V.VoucherId, calificacion, 0, User.SubSistema).Rows[0][2].ToString();
			}
			catch (Exception)
			{
				text = "TI000001";
			}
		}
		else
		{
			text = "TI000001";
		}
		if (text == "TI000001")
		{
			"No se ha podido finalizar el examen                       ".Bitacora("000008", "Examen", "Fin   ", "000896", "000011");
			finalizado = false;
		}
		else
		{
			"Se ha finalizado el examen                                ".Bitacora("000008", "Examen", "Fin   ", "000901", "000012");
			finalizado = true;
		}
		cabecera = cabecera + "En línea|" + calificacion + "|" + FechaInicio.FechaDecimal() + "|" + FechaFin.FechaDecimal() + "|0|" + VersionAplicacion + "|20|2000|" + NombreUsuarioPC + "|" + NombrePC + "|" + DireccionIP + "|" + DireccionMAC;
		text2 = evaluaasi.Preguntas.GenerarDetalle();
		Meses meses = new Meses();
		meses.Mes = FechaFin.Month.GetLetraMesDesencriptar();
		meses.Valor = FechaFin.Month;
		Encripcion encripcion = new Encripcion(cabecera, meses);
		cabecera = encripcion.TextoEncriptado.ReverseString();
		text2 = evaluaasi.Preguntas.GenerarDetalle();
		encripcion = new Encripcion(text2, meses);
		text2 = encripcion.TextoEncriptado.ReverseString();
		if (!Directory.Exists("Resultados"))
		{
			Directory.CreateDirectory("Resultados");
		}
		if (!Directory.Exists("Constancias"))
		{
			Directory.CreateDirectory("Constancias");
		}
		"Generando txt de resultados                               ".Bitacora("000008", "Examen", "Fin   ", "000943", "000018");
		try
		{
			string[] files = Directory.GetFiles(appPath + "\\Resultados\\", V.VoucherCode + "*.txt");
			if (files.Count() > 0)
			{
				nombreArchivo = V.VoucherCode + "(" + files.Count() + ")";
			}
			else
			{
				nombreArchivo = V.VoucherCode;
			}
			File.WriteAllLines("Resultados\\" + nombreArchivo + ".txt", new string[2]
			{
				cabecera + meses.Mes,
				text2
			}, Encoding.Default);
			"Generando constancia                                      ".Bitacora("000008", "Examen", "Fin   ", "000943", "000017");
			Bitmap bitmap = new Bitmap(Resources.background_carta);
			Graphics.FromImage(bitmap).GenerarConstancia(User, V, calificacion, InLine, FechaFin, evaluaasi.Nombre, evaluaasi.Preguntas, evaluaasi.Categorias, cabecera + meses.Mes, text);
			bitmap = Stegnography.embedText($"{cabecera}{meses.Mes}{Environment.NewLine}{text2}", bitmap);
			bitmap.Save(appPath + "\\Constancias\\" + nombreArchivo + ".png", ImageFormat.Png);
			V.Resultado = calificacion;
			base.DialogResult = DialogResult.OK;
			Close();
		}
		catch (Exception)
		{
		}
		"Se ha finalizado el examen                 ".Bitacora("000008", "Examen", "Fin   ", "000943", "000016");
	}

	private void bgwFinalizar_ProgressChanged(object sender, ProgressChangedEventArgs e)
	{
	}

	private void bgwFinalizar_RunWorkerCompleted(object sender, RunWorkerCompletedEventArgs e)
	{
		Cursor.Current = Cursors.Default;
		Question question = new Question();
		if (e.Cancelled)
		{
			MessageBox.Show(e.Error.Message);
			return;
		}
		if (e.Error != null)
		{
			MessageBox.Show(e.Error.Message);
			return;
		}
		try
		{
			if (!finalizado)
			{
				string text = "";
				question.lblTitulo.Text = "Evaluaasi";
				text = "No ha sido posible sincronizar tu resultado debido a una falla en la conexión a internet." + Environment.NewLine + Environment.NewLine;
				text = text + "Para sincronizar tu resultado es importante que respaldes los siguientes archivos:" + Environment.NewLine;
				text = text + appPath + "\\Resultados\\" + nombreArchivo + ".txt" + Environment.NewLine;
				text = text + appPath + "\\Constancias\\" + nombreArchivo + ".png" + Environment.NewLine + Environment.NewLine;
				text = text + "Nota: Utiliza los botónes ubicados en la parte inferior para abrir las carpetas de constancias y resultados." + Environment.NewLine + Environment.NewLine;
				text += "Para cualquier duda o aclaración contacta a soporte técnico al correo: soporte@grupoeduit.com o puedes llamarnos al 01 (800) 808 6240";
				question.Height = 500;
				question.lblDetalle.Text = text;
				question.btnSi.Visible = false;
				question.btnNo.Visible = false;
				question.ShowDialog();
			}
			pbSpinner.Image = null;
			pbSpinner.Visible = false;
			pbSpinner.SendToBack();
			base.DialogResult = DialogResult.OK;
			Close();
		}
		catch (Exception)
		{
		}
	}

	private void bgwCargarPregunta_DoWork(object sender, DoWorkEventArgs e)
	{
		CargarPanel(p);
	}

	private void bgwCargarPregunta_ProgressChanged(object sender, ProgressChangedEventArgs e)
	{
	}

	private void bgwCargarPregunta_RunWorkerCompleted(object sender, RunWorkerCompletedEventArgs e)
	{
		if (p.Estatus == 0 || p.Estatus == 2)
		{
			btnOmitir.Visible = true;
		}
		else if (p.Estatus == 1)
		{
			btnOmitir.Visible = false;
		}
		switch (p.TipoPregunta)
		{
		case eTipoPregunta.OpcionMultiple:
			BooleanExtensions.IniciarPanel(visible: true, ref pnlOpcionMultiple);
			pnlOpcionMultiple.Controls.AddRange(controlesParaPanel.ToArray());
			break;
		case eTipoPregunta.SeleccionMultiple:
			BooleanExtensions.IniciarPanel(visible: true, ref pnlSeleccionMultiple);
			pnlSeleccionMultiple.Controls.AddRange(controlesParaPanel.ToArray());
			break;
		case eTipoPregunta.ArrastrarSoltar:
			BooleanExtensions.IniciarPanel(visible: true, ref pnlDragDrop);
			pnlOrigenArrastrarSoltar.Controls.AddRange(controlesParaPanel.ToArray());
			pnlDestinoArrastrarSoltar.Controls.AddRange(controlesParaPanel2.ToArray());
			break;
		case eTipoPregunta.Ordenamiento:
			BooleanExtensions.IniciarPanel(visible: true, ref PnlDragDropPanels);
			PnlDragDropPanels.Controls.AddRange(controlesParaPanel.ToArray());
			break;
		case eTipoPregunta.TrueFalse:
			BooleanExtensions.IniciarPanel(visible: true, ref pnlSeleccionMultiple);
			pnlSeleccionMultiple.Controls.AddRange(controlesParaPanel.ToArray());
			break;
		case eTipoPregunta.OrdenarPanelDragDrop:
			BooleanExtensions.IniciarPanel(visible: true, ref pnlArrastraOrdena);
			pnlOrigenArrastrarOrdenar.Controls.AddRange(controlesParaPanel.ToArray());
			pnlDestinoArrastrarOrdenar.Controls.AddRange(controlesParaPanel2.ToArray());
			break;
		}
	}

	private void GenerarConstnacia()
	{
		Document document = new Document(PageSize.LETTER);
		MemoryStream os = new MemoryStream();
		PdfWriter.GetInstance(document, os);
		document.AddTitle("Mi primer PDF");
		document.AddCreator("Evaluaasi PDF");
		document.Open();
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
		System.ComponentModel.ComponentResourceManager resources = new System.ComponentModel.ComponentResourceManager(typeof(CulturaDigital.Forms.CulturaDigital_Examen));
		this.pnlTitle = new System.Windows.Forms.Panel();
		this.tipoLbl = new System.Windows.Forms.Label();
		this.nombreExamenLbl = new System.Windows.Forms.Label();
		this.pbHelp = new System.Windows.Forms.PictureBox();
		this.lblVersion = new System.Windows.Forms.Label();
		this.lblVoucher = new System.Windows.Forms.Label();
		this.btnCerrarExamen = new System.Windows.Forms.Button();
		this.pbtitulo = new System.Windows.Forms.PictureBox();
		this.pnlsplash = new System.Windows.Forms.Panel();
		this.pnlFooter = new System.Windows.Forms.Panel();
		this.pnlContenedorTimmer = new System.Windows.Forms.Panel();
		this.lblMinutos = new System.Windows.Forms.Label();
		this.pnlContenedorTotales = new System.Windows.Forms.Panel();
		this.lblTextoOmitidas = new System.Windows.Forms.Label();
		this.lblTextoResueltas = new System.Windows.Forms.Label();
		this.lblTextoRestantes = new System.Windows.Forms.Label();
		this.btnResueltasCount = new System.Windows.Forms.Button();
		this.btnRestantesCount = new System.Windows.Forms.Button();
		this.btnOmitidasCount = new System.Windows.Forms.Button();
		this.pnlContenedorBotones = new System.Windows.Forms.Panel();
		this.btnOmitir = new System.Windows.Forms.Button();
		this.btnReiniciar = new System.Windows.Forms.Button();
		this.btnFinalizar = new System.Windows.Forms.Button();
		this.pbSpinner = new System.Windows.Forms.PictureBox();
		this.pnlTextoPregunta = new System.Windows.Forms.Panel();
		this.lblTextoPregunta = new System.Windows.Forms.Label();
		this.pnlPreguntas = new System.Windows.Forms.Panel();
		this.pnlOpcionMultiple = new System.Windows.Forms.Panel();
		this.pnlSeleccionMultiple = new System.Windows.Forms.Panel();
		this.pnlDragDrop = new System.Windows.Forms.Panel();
		this.pnlDestinoArrastrarSoltar = new System.Windows.Forms.FlowLayoutPanel();
		this.pnlOrigenArrastrarSoltar = new System.Windows.Forms.FlowLayoutPanel();
		this.tmr = new System.Windows.Forms.Timer(this.components);
		this.bgwFinalizar = new System.ComponentModel.BackgroundWorker();
		this.pnlContenedorPaneles = new System.Windows.Forms.Panel();
		this.pnlArrastraOrdena = new System.Windows.Forms.Panel();
		this.pnlOrigenArrastrarOrdenar = new System.Windows.Forms.FlowLayoutPanel();
		this.pnlDestinoArrastrarOrdenar = new System.Windows.Forms.FlowLayoutPanel();
		this.PnlDragDropPanels = new System.Windows.Forms.Panel();
		this.flpOrdenamiento = new System.Windows.Forms.FlowLayoutPanel();
		this.bgwCargarPregunta = new System.ComponentModel.BackgroundWorker();
		this.skinImage1 = new CulturaDigital.SkinControls.SkinImage();
		this.pnlTitle.SuspendLayout();
		((System.ComponentModel.ISupportInitialize)this.pbHelp).BeginInit();
		((System.ComponentModel.ISupportInitialize)this.pbtitulo).BeginInit();
		this.pnlFooter.SuspendLayout();
		this.pnlContenedorTimmer.SuspendLayout();
		this.pnlContenedorTotales.SuspendLayout();
		this.pnlContenedorBotones.SuspendLayout();
		((System.ComponentModel.ISupportInitialize)this.pbSpinner).BeginInit();
		this.pnlTextoPregunta.SuspendLayout();
		this.pnlDragDrop.SuspendLayout();
		this.pnlContenedorPaneles.SuspendLayout();
		this.pnlArrastraOrdena.SuspendLayout();
		this.PnlDragDropPanels.SuspendLayout();
		base.SuspendLayout();
		this.pnlTitle.BackColor = System.Drawing.Color.Transparent;
		this.pnlTitle.BackgroundImageLayout = System.Windows.Forms.ImageLayout.Stretch;
		this.pnlTitle.Controls.Add(this.tipoLbl);
		this.pnlTitle.Controls.Add(this.nombreExamenLbl);
		this.pnlTitle.Controls.Add(this.pbHelp);
		this.pnlTitle.Controls.Add(this.lblVersion);
		this.pnlTitle.Controls.Add(this.lblVoucher);
		this.pnlTitle.Controls.Add(this.btnCerrarExamen);
		this.pnlTitle.Controls.Add(this.pbtitulo);
		this.pnlTitle.Dock = System.Windows.Forms.DockStyle.Top;
		this.pnlTitle.Location = new System.Drawing.Point(0, 0);
		this.pnlTitle.Name = "pnlTitle";
		this.pnlTitle.Size = new System.Drawing.Size(1024, 75);
		this.pnlTitle.TabIndex = 1;
		this.tipoLbl.Anchor = System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Left;
		this.tipoLbl.AutoSize = true;
		this.tipoLbl.BackColor = System.Drawing.Color.Transparent;
		this.tipoLbl.Font = new System.Drawing.Font("Segoe UI", 14.25f);
		this.tipoLbl.ForeColor = System.Drawing.Color.White;
		this.tipoLbl.Location = new System.Drawing.Point(46, 11);
		this.tipoLbl.Name = "tipoLbl";
		this.tipoLbl.Size = new System.Drawing.Size(131, 25);
		this.tipoLbl.TabIndex = 22;
		this.tipoLbl.Text = "Tipo pregunta";
		this.nombreExamenLbl.Anchor = System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Left;
		this.nombreExamenLbl.AutoSize = true;
		this.nombreExamenLbl.BackColor = System.Drawing.Color.Transparent;
		this.nombreExamenLbl.Font = new System.Drawing.Font("Segoe UI", 15.75f, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, 0);
		this.nombreExamenLbl.ForeColor = System.Drawing.Color.White;
		this.nombreExamenLbl.Location = new System.Drawing.Point(468, 3);
		this.nombreExamenLbl.Name = "nombreExamenLbl";
		this.nombreExamenLbl.Size = new System.Drawing.Size(68, 30);
		this.nombreExamenLbl.TabIndex = 21;
		this.nombreExamenLbl.Text = "label4";
		this.nombreExamenLbl.Visible = false;
		this.pbHelp.BackgroundImage = CulturaDigital.Properties.Resources.Help;
		this.pbHelp.BackgroundImageLayout = System.Windows.Forms.ImageLayout.Zoom;
		this.pbHelp.Location = new System.Drawing.Point(3, 3);
		this.pbHelp.Name = "pbHelp";
		this.pbHelp.Size = new System.Drawing.Size(37, 37);
		this.pbHelp.TabIndex = 10;
		this.pbHelp.TabStop = false;
		this.pbHelp.Click += new System.EventHandler(pictureBox1_Click);
		this.lblVersion.Anchor = System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Left;
		this.lblVersion.AutoSize = true;
		this.lblVersion.BackColor = System.Drawing.Color.Transparent;
		this.lblVersion.Font = new System.Drawing.Font("Segoe UI", 14.25f);
		this.lblVersion.ForeColor = System.Drawing.Color.White;
		this.lblVersion.Location = new System.Drawing.Point(-2, 36);
		this.lblVersion.Name = "lblVersion";
		this.lblVersion.Size = new System.Drawing.Size(63, 25);
		this.lblVersion.TabIndex = 9;
		this.lblVersion.Text = "label4";
		this.lblVoucher.Anchor = System.Windows.Forms.AnchorStyles.Right;
		this.lblVoucher.AutoSize = true;
		this.lblVoucher.Font = new System.Drawing.Font("Segoe UI", 14.25f, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, 0);
		this.lblVoucher.ForeColor = System.Drawing.Color.White;
		this.lblVoucher.Location = new System.Drawing.Point(661, 37);
		this.lblVoucher.Name = "lblVoucher";
		this.lblVoucher.RightToLeft = System.Windows.Forms.RightToLeft.Yes;
		this.lblVoucher.Size = new System.Drawing.Size(349, 25);
		this.lblVoucher.TabIndex = 6;
		this.lblVoucher.Text = "Voucher: XXXX-XXXX-XXXX-XXXX - 0000";
		this.lblVoucher.TextAlign = System.Drawing.ContentAlignment.TopCenter;
		this.btnCerrarExamen.Anchor = System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Right;
		this.btnCerrarExamen.BackColor = System.Drawing.Color.Red;
		this.btnCerrarExamen.BackgroundImage = CulturaDigital.Properties.Resources.btn_cerrar_reposo;
		this.btnCerrarExamen.BackgroundImageLayout = System.Windows.Forms.ImageLayout.Stretch;
		this.btnCerrarExamen.FlatAppearance.BorderColor = System.Drawing.Color.White;
		this.btnCerrarExamen.FlatAppearance.BorderSize = 0;
		this.btnCerrarExamen.FlatStyle = System.Windows.Forms.FlatStyle.Flat;
		this.btnCerrarExamen.Location = new System.Drawing.Point(975, 0);
		this.btnCerrarExamen.Name = "btnCerrarExamen";
		this.btnCerrarExamen.Size = new System.Drawing.Size(50, 34);
		this.btnCerrarExamen.TabIndex = 2;
		this.btnCerrarExamen.UseVisualStyleBackColor = false;
		this.btnCerrarExamen.Visible = false;
		this.btnCerrarExamen.Click += new System.EventHandler(btnCerrarExamen_Click);
		this.pbtitulo.Anchor = System.Windows.Forms.AnchorStyles.Left | System.Windows.Forms.AnchorStyles.Right;
		this.pbtitulo.BackgroundImageLayout = System.Windows.Forms.ImageLayout.Center;
		this.pbtitulo.Location = new System.Drawing.Point(0, -3);
		this.pbtitulo.Name = "pbtitulo";
		this.pbtitulo.Size = new System.Drawing.Size(1025, 72);
		this.pbtitulo.TabIndex = 19;
		this.pbtitulo.TabStop = false;
		this.pnlsplash.Anchor = System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Left | System.Windows.Forms.AnchorStyles.Right;
		this.pnlsplash.BackColor = System.Drawing.Color.Transparent;
		this.pnlsplash.BackgroundImageLayout = System.Windows.Forms.ImageLayout.Stretch;
		this.pnlsplash.Location = new System.Drawing.Point(26, 8);
		this.pnlsplash.Name = "pnlsplash";
		this.pnlsplash.Size = new System.Drawing.Size(976, 569);
		this.pnlsplash.TabIndex = 7;
		this.pnlFooter.BackColor = System.Drawing.Color.White;
		this.pnlFooter.BackgroundImage = CulturaDigital.Properties.Resources.indicacionesexamen;
		this.pnlFooter.Controls.Add(this.pnlContenedorTimmer);
		this.pnlFooter.Controls.Add(this.pnlContenedorTotales);
		this.pnlFooter.Controls.Add(this.pnlContenedorBotones);
		this.pnlFooter.Controls.Add(this.pnlTextoPregunta);
		this.pnlFooter.Dock = System.Windows.Forms.DockStyle.Bottom;
		this.pnlFooter.Location = new System.Drawing.Point(0, 589);
		this.pnlFooter.Name = "pnlFooter";
		this.pnlFooter.Size = new System.Drawing.Size(1024, 104);
		this.pnlFooter.TabIndex = 6;
		this.pnlContenedorTimmer.Anchor = System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Right;
		this.pnlContenedorTimmer.Controls.Add(this.lblMinutos);
		this.pnlContenedorTimmer.Location = new System.Drawing.Point(899, 11);
		this.pnlContenedorTimmer.Name = "pnlContenedorTimmer";
		this.pnlContenedorTimmer.Size = new System.Drawing.Size(121, 87);
		this.pnlContenedorTimmer.TabIndex = 29;
		this.lblMinutos.BackColor = System.Drawing.Color.Transparent;
		this.lblMinutos.Dock = System.Windows.Forms.DockStyle.Fill;
		this.lblMinutos.Font = new System.Drawing.Font("Arial", 29f);
		this.lblMinutos.ForeColor = System.Drawing.Color.Black;
		this.lblMinutos.Location = new System.Drawing.Point(0, 0);
		this.lblMinutos.Name = "lblMinutos";
		this.lblMinutos.Size = new System.Drawing.Size(121, 87);
		this.lblMinutos.TabIndex = 10;
		this.lblMinutos.Text = "60:60";
		this.lblMinutos.TextAlign = System.Drawing.ContentAlignment.MiddleCenter;
		this.pnlContenedorTotales.Anchor = System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Right;
		this.pnlContenedorTotales.Controls.Add(this.lblTextoOmitidas);
		this.pnlContenedorTotales.Controls.Add(this.lblTextoResueltas);
		this.pnlContenedorTotales.Controls.Add(this.lblTextoRestantes);
		this.pnlContenedorTotales.Controls.Add(this.btnResueltasCount);
		this.pnlContenedorTotales.Controls.Add(this.btnRestantesCount);
		this.pnlContenedorTotales.Controls.Add(this.btnOmitidasCount);
		this.pnlContenedorTotales.Location = new System.Drawing.Point(700, 11);
		this.pnlContenedorTotales.Name = "pnlContenedorTotales";
		this.pnlContenedorTotales.Size = new System.Drawing.Size(193, 88);
		this.pnlContenedorTotales.TabIndex = 28;
		this.lblTextoOmitidas.Anchor = System.Windows.Forms.AnchorStyles.Right;
		this.lblTextoOmitidas.AutoSize = true;
		this.lblTextoOmitidas.BackColor = System.Drawing.Color.Transparent;
		this.lblTextoOmitidas.Font = new System.Drawing.Font("Segoe UI", 9.75f, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, 0);
		this.lblTextoOmitidas.ForeColor = System.Drawing.Color.Black;
		this.lblTextoOmitidas.Location = new System.Drawing.Point(131, 66);
		this.lblTextoOmitidas.Name = "lblTextoOmitidas";
		this.lblTextoOmitidas.Size = new System.Drawing.Size(60, 17);
		this.lblTextoOmitidas.TabIndex = 28;
		this.lblTextoOmitidas.Text = "Omitidas";
		this.lblTextoResueltas.Anchor = System.Windows.Forms.AnchorStyles.Right;
		this.lblTextoResueltas.AutoSize = true;
		this.lblTextoResueltas.BackColor = System.Drawing.Color.Transparent;
		this.lblTextoResueltas.Font = new System.Drawing.Font("Segoe UI", 9.75f, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, 0);
		this.lblTextoResueltas.ForeColor = System.Drawing.Color.Black;
		this.lblTextoResueltas.Location = new System.Drawing.Point(3, 66);
		this.lblTextoResueltas.Name = "lblTextoResueltas";
		this.lblTextoResueltas.Size = new System.Drawing.Size(63, 17);
		this.lblTextoResueltas.TabIndex = 29;
		this.lblTextoResueltas.Text = "Resueltas";
		this.lblTextoResueltas.TextAlign = System.Drawing.ContentAlignment.TopCenter;
		this.lblTextoRestantes.Anchor = System.Windows.Forms.AnchorStyles.Right;
		this.lblTextoRestantes.AutoSize = true;
		this.lblTextoRestantes.BackColor = System.Drawing.Color.Transparent;
		this.lblTextoRestantes.Font = new System.Drawing.Font("Segoe UI", 9.75f, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, 0);
		this.lblTextoRestantes.ForeColor = System.Drawing.Color.Black;
		this.lblTextoRestantes.Location = new System.Drawing.Point(66, 66);
		this.lblTextoRestantes.Name = "lblTextoRestantes";
		this.lblTextoRestantes.Size = new System.Drawing.Size(64, 17);
		this.lblTextoRestantes.TabIndex = 30;
		this.lblTextoRestantes.Text = "Restantes";
		this.btnResueltasCount.Anchor = System.Windows.Forms.AnchorStyles.Right;
		this.btnResueltasCount.BackColor = System.Drawing.Color.FromArgb(21, 187, 249);
		this.btnResueltasCount.BackgroundImageLayout = System.Windows.Forms.ImageLayout.Center;
		this.btnResueltasCount.FlatAppearance.BorderColor = System.Drawing.Color.FromArgb(21, 187, 249);
		this.btnResueltasCount.FlatAppearance.BorderSize = 2;
		this.btnResueltasCount.FlatAppearance.MouseDownBackColor = System.Drawing.Color.FromArgb(21, 187, 249);
		this.btnResueltasCount.FlatAppearance.MouseOverBackColor = System.Drawing.Color.FromArgb(21, 187, 249);
		this.btnResueltasCount.FlatStyle = System.Windows.Forms.FlatStyle.Flat;
		this.btnResueltasCount.Font = new System.Drawing.Font("Segoe UI", 20.25f);
		this.btnResueltasCount.ForeColor = System.Drawing.Color.White;
		this.btnResueltasCount.Location = new System.Drawing.Point(4, 5);
		this.btnResueltasCount.Name = "btnResueltasCount";
		this.btnResueltasCount.Size = new System.Drawing.Size(60, 60);
		this.btnResueltasCount.TabIndex = 31;
		this.btnResueltasCount.UseVisualStyleBackColor = false;
		this.btnRestantesCount.Anchor = System.Windows.Forms.AnchorStyles.Right;
		this.btnRestantesCount.BackColor = System.Drawing.Color.FromArgb(12, 29, 72);
		this.btnRestantesCount.BackgroundImageLayout = System.Windows.Forms.ImageLayout.Center;
		this.btnRestantesCount.FlatAppearance.BorderColor = System.Drawing.Color.FromArgb(12, 29, 72);
		this.btnRestantesCount.FlatAppearance.BorderSize = 2;
		this.btnRestantesCount.FlatAppearance.MouseDownBackColor = System.Drawing.Color.FromArgb(12, 29, 72);
		this.btnRestantesCount.FlatAppearance.MouseOverBackColor = System.Drawing.Color.FromArgb(12, 29, 72);
		this.btnRestantesCount.FlatStyle = System.Windows.Forms.FlatStyle.Flat;
		this.btnRestantesCount.Font = new System.Drawing.Font("Segoe UI", 20.25f);
		this.btnRestantesCount.ForeColor = System.Drawing.Color.White;
		this.btnRestantesCount.Location = new System.Drawing.Point(67, 5);
		this.btnRestantesCount.Name = "btnRestantesCount";
		this.btnRestantesCount.Size = new System.Drawing.Size(60, 60);
		this.btnRestantesCount.TabIndex = 32;
		this.btnRestantesCount.UseVisualStyleBackColor = false;
		this.btnOmitidasCount.Anchor = System.Windows.Forms.AnchorStyles.Right;
		this.btnOmitidasCount.BackColor = System.Drawing.Color.FromArgb(26, 112, 199);
		this.btnOmitidasCount.BackgroundImageLayout = System.Windows.Forms.ImageLayout.Center;
		this.btnOmitidasCount.FlatAppearance.BorderColor = System.Drawing.Color.FromArgb(26, 112, 199);
		this.btnOmitidasCount.FlatAppearance.BorderSize = 2;
		this.btnOmitidasCount.FlatAppearance.MouseDownBackColor = System.Drawing.Color.FromArgb(26, 112, 199);
		this.btnOmitidasCount.FlatAppearance.MouseOverBackColor = System.Drawing.Color.FromArgb(26, 112, 199);
		this.btnOmitidasCount.FlatStyle = System.Windows.Forms.FlatStyle.Flat;
		this.btnOmitidasCount.Font = new System.Drawing.Font("Segoe UI", 20.25f);
		this.btnOmitidasCount.ForeColor = System.Drawing.Color.White;
		this.btnOmitidasCount.Location = new System.Drawing.Point(130, 5);
		this.btnOmitidasCount.Name = "btnOmitidasCount";
		this.btnOmitidasCount.Size = new System.Drawing.Size(60, 60);
		this.btnOmitidasCount.TabIndex = 33;
		this.btnOmitidasCount.UseVisualStyleBackColor = false;
		this.pnlContenedorBotones.Anchor = System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Right;
		this.pnlContenedorBotones.Controls.Add(this.btnOmitir);
		this.pnlContenedorBotones.Controls.Add(this.btnReiniciar);
		this.pnlContenedorBotones.Controls.Add(this.btnFinalizar);
		this.pnlContenedorBotones.Controls.Add(this.pbSpinner);
		this.pnlContenedorBotones.Location = new System.Drawing.Point(489, 11);
		this.pnlContenedorBotones.Name = "pnlContenedorBotones";
		this.pnlContenedorBotones.Size = new System.Drawing.Size(204, 88);
		this.pnlContenedorBotones.TabIndex = 30;
		this.btnOmitir.Anchor = System.Windows.Forms.AnchorStyles.Right;
		this.btnOmitir.BackColor = System.Drawing.Color.FromArgb(145, 195, 19);
		this.btnOmitir.BackgroundImage = CulturaDigital.Properties.Resources.Timer_Mark;
		this.btnOmitir.BackgroundImageLayout = System.Windows.Forms.ImageLayout.Center;
		this.btnOmitir.FlatAppearance.BorderSize = 0;
		this.btnOmitir.FlatAppearance.MouseDownBackColor = System.Drawing.Color.FromArgb(87, 108, 15);
		this.btnOmitir.FlatAppearance.MouseOverBackColor = System.Drawing.Color.FromArgb(121, 164, 22);
		this.btnOmitir.FlatStyle = System.Windows.Forms.FlatStyle.Flat;
		this.btnOmitir.ForeColor = System.Drawing.Color.White;
		this.btnOmitir.Location = new System.Drawing.Point(134, 5);
		this.btnOmitir.Name = "btnOmitir";
		this.btnOmitir.Size = new System.Drawing.Size(60, 60);
		this.btnOmitir.TabIndex = 28;
		this.btnOmitir.UseVisualStyleBackColor = false;
		this.btnOmitir.Click += new System.EventHandler(btnOmitir_Click);
		this.btnReiniciar.Anchor = System.Windows.Forms.AnchorStyles.Right;
		this.btnReiniciar.BackColor = System.Drawing.Color.FromArgb(254, 185, 20);
		this.btnReiniciar.BackgroundImage = CulturaDigital.Properties.Resources.Reload_Mark;
		this.btnReiniciar.BackgroundImageLayout = System.Windows.Forms.ImageLayout.Center;
		this.btnReiniciar.FlatAppearance.BorderSize = 0;
		this.btnReiniciar.FlatAppearance.MouseDownBackColor = System.Drawing.Color.FromArgb(255, 109, 14);
		this.btnReiniciar.FlatAppearance.MouseOverBackColor = System.Drawing.Color.FromArgb(255, 164, 21);
		this.btnReiniciar.FlatStyle = System.Windows.Forms.FlatStyle.Flat;
		this.btnReiniciar.ForeColor = System.Drawing.Color.White;
		this.btnReiniciar.Location = new System.Drawing.Point(71, 5);
		this.btnReiniciar.Name = "btnReiniciar";
		this.btnReiniciar.Size = new System.Drawing.Size(60, 60);
		this.btnReiniciar.TabIndex = 27;
		this.btnReiniciar.UseVisualStyleBackColor = false;
		this.btnReiniciar.Click += new System.EventHandler(btnReiniciar_Click);
		this.btnFinalizar.Anchor = System.Windows.Forms.AnchorStyles.Right;
		this.btnFinalizar.BackColor = System.Drawing.Color.FromArgb(21, 163, 239);
		this.btnFinalizar.BackgroundImage = CulturaDigital.Properties.Resources.Check_Mark;
		this.btnFinalizar.BackgroundImageLayout = System.Windows.Forms.ImageLayout.Center;
		this.btnFinalizar.FlatAppearance.BorderSize = 0;
		this.btnFinalizar.FlatAppearance.MouseDownBackColor = System.Drawing.Color.FromArgb(17, 113, 174);
		this.btnFinalizar.FlatAppearance.MouseOverBackColor = System.Drawing.Color.FromArgb(24, 145, 197);
		this.btnFinalizar.FlatStyle = System.Windows.Forms.FlatStyle.Flat;
		this.btnFinalizar.ForeColor = System.Drawing.Color.White;
		this.btnFinalizar.Location = new System.Drawing.Point(8, 5);
		this.btnFinalizar.Name = "btnFinalizar";
		this.btnFinalizar.Size = new System.Drawing.Size(60, 60);
		this.btnFinalizar.TabIndex = 26;
		this.btnFinalizar.UseVisualStyleBackColor = false;
		this.btnFinalizar.Click += new System.EventHandler(btnFinalizar_Click);
		this.pbSpinner.BackColor = System.Drawing.Color.Transparent;
		this.pbSpinner.Dock = System.Windows.Forms.DockStyle.Fill;
		this.pbSpinner.Location = new System.Drawing.Point(0, 0);
		this.pbSpinner.Name = "pbSpinner";
		this.pbSpinner.Size = new System.Drawing.Size(204, 88);
		this.pbSpinner.TabIndex = 25;
		this.pbSpinner.TabStop = false;
		this.pbSpinner.WaitOnLoad = true;
		this.pnlTextoPregunta.Anchor = System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Left | System.Windows.Forms.AnchorStyles.Right;
		this.pnlTextoPregunta.AutoScroll = true;
		this.pnlTextoPregunta.AutoScrollMinSize = new System.Drawing.Size(0, 75);
		this.pnlTextoPregunta.BackColor = System.Drawing.Color.Transparent;
		this.pnlTextoPregunta.Controls.Add(this.lblTextoPregunta);
		this.pnlTextoPregunta.Location = new System.Drawing.Point(4, 11);
		this.pnlTextoPregunta.Name = "pnlTextoPregunta";
		this.pnlTextoPregunta.Size = new System.Drawing.Size(479, 88);
		this.pnlTextoPregunta.TabIndex = 10;
		this.lblTextoPregunta.AutoSize = true;
		this.lblTextoPregunta.BackColor = System.Drawing.Color.Transparent;
		this.lblTextoPregunta.Font = new System.Drawing.Font("Segoe UI", 11.25f, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, 0);
		this.lblTextoPregunta.ForeColor = System.Drawing.Color.White;
		this.lblTextoPregunta.Location = new System.Drawing.Point(0, 0);
		this.lblTextoPregunta.MaximumSize = new System.Drawing.Size(0, 1000);
		this.lblTextoPregunta.Name = "lblTextoPregunta";
		this.lblTextoPregunta.Size = new System.Drawing.Size(50, 20);
		this.lblTextoPregunta.TabIndex = 0;
		this.lblTextoPregunta.Text = "label9";
		this.pnlPreguntas.Anchor = System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Left | System.Windows.Forms.AnchorStyles.Right;
		this.pnlPreguntas.BackColor = System.Drawing.Color.DimGray;
		this.pnlPreguntas.BackgroundImage = CulturaDigital.Properties.Resources.fondo_preguntas;
		this.pnlPreguntas.BackgroundImageLayout = System.Windows.Forms.ImageLayout.Stretch;
		this.pnlPreguntas.Location = new System.Drawing.Point(26, 8);
		this.pnlPreguntas.Name = "pnlPreguntas";
		this.pnlPreguntas.Size = new System.Drawing.Size(976, 573);
		this.pnlPreguntas.TabIndex = 8;
		this.pnlOpcionMultiple.Anchor = System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Left | System.Windows.Forms.AnchorStyles.Right;
		this.pnlOpcionMultiple.BackColor = System.Drawing.Color.White;
		this.pnlOpcionMultiple.BackgroundImage = CulturaDigital.Properties.Resources.fondo_preguntas;
		this.pnlOpcionMultiple.BackgroundImageLayout = System.Windows.Forms.ImageLayout.Stretch;
		this.pnlOpcionMultiple.Location = new System.Drawing.Point(26, 8);
		this.pnlOpcionMultiple.Name = "pnlOpcionMultiple";
		this.pnlOpcionMultiple.Size = new System.Drawing.Size(976, 573);
		this.pnlOpcionMultiple.TabIndex = 9;
		this.pnlSeleccionMultiple.Anchor = System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Left | System.Windows.Forms.AnchorStyles.Right;
		this.pnlSeleccionMultiple.BackColor = System.Drawing.Color.White;
		this.pnlSeleccionMultiple.BackgroundImageLayout = System.Windows.Forms.ImageLayout.Stretch;
		this.pnlSeleccionMultiple.ForeColor = System.Drawing.Color.White;
		this.pnlSeleccionMultiple.Location = new System.Drawing.Point(26, 8);
		this.pnlSeleccionMultiple.Name = "pnlSeleccionMultiple";
		this.pnlSeleccionMultiple.Size = new System.Drawing.Size(976, 573);
		this.pnlSeleccionMultiple.TabIndex = 11;
		this.pnlDragDrop.Anchor = System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Left | System.Windows.Forms.AnchorStyles.Right;
		this.pnlDragDrop.BackColor = System.Drawing.Color.White;
		this.pnlDragDrop.BackgroundImage = CulturaDigital.Properties.Resources.fondo_preguntas;
		this.pnlDragDrop.BackgroundImageLayout = System.Windows.Forms.ImageLayout.Stretch;
		this.pnlDragDrop.Controls.Add(this.pnlDestinoArrastrarSoltar);
		this.pnlDragDrop.Controls.Add(this.pnlOrigenArrastrarSoltar);
		this.pnlDragDrop.Location = new System.Drawing.Point(26, 8);
		this.pnlDragDrop.Name = "pnlDragDrop";
		this.pnlDragDrop.Size = new System.Drawing.Size(976, 573);
		this.pnlDragDrop.TabIndex = 13;
		this.pnlDestinoArrastrarSoltar.AllowDrop = true;
		this.pnlDestinoArrastrarSoltar.Anchor = System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Right;
		this.pnlDestinoArrastrarSoltar.BackColor = System.Drawing.Color.WhiteSmoke;
		this.pnlDestinoArrastrarSoltar.Location = new System.Drawing.Point(580, 17);
		this.pnlDestinoArrastrarSoltar.Name = "pnlDestinoArrastrarSoltar";
		this.pnlDestinoArrastrarSoltar.Size = new System.Drawing.Size(383, 424);
		this.pnlDestinoArrastrarSoltar.TabIndex = 3;
		this.pnlOrigenArrastrarSoltar.AllowDrop = true;
		this.pnlOrigenArrastrarSoltar.Anchor = System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Left;
		this.pnlOrigenArrastrarSoltar.BackColor = System.Drawing.Color.WhiteSmoke;
		this.pnlOrigenArrastrarSoltar.Location = new System.Drawing.Point(10, 17);
		this.pnlOrigenArrastrarSoltar.Name = "pnlOrigenArrastrarSoltar";
		this.pnlOrigenArrastrarSoltar.Size = new System.Drawing.Size(383, 424);
		this.pnlOrigenArrastrarSoltar.TabIndex = 2;
		this.tmr.Interval = 1000;
		this.tmr.Tick += new System.EventHandler(tmr_Tick);
		this.bgwFinalizar.WorkerReportsProgress = true;
		this.bgwFinalizar.WorkerSupportsCancellation = true;
		this.bgwFinalizar.DoWork += new System.ComponentModel.DoWorkEventHandler(bgwFinalizar_DoWork);
		this.bgwFinalizar.ProgressChanged += new System.ComponentModel.ProgressChangedEventHandler(bgwFinalizar_ProgressChanged);
		this.bgwFinalizar.RunWorkerCompleted += new System.ComponentModel.RunWorkerCompletedEventHandler(bgwFinalizar_RunWorkerCompleted);
		this.pnlContenedorPaneles.BackColor = System.Drawing.Color.White;
		this.pnlContenedorPaneles.Controls.Add(this.pnlArrastraOrdena);
		this.pnlContenedorPaneles.Controls.Add(this.pnlFooter);
		this.pnlContenedorPaneles.Controls.Add(this.pnlsplash);
		this.pnlContenedorPaneles.Controls.Add(this.PnlDragDropPanels);
		this.pnlContenedorPaneles.Controls.Add(this.pnlSeleccionMultiple);
		this.pnlContenedorPaneles.Controls.Add(this.pnlOpcionMultiple);
		this.pnlContenedorPaneles.Controls.Add(this.pnlDragDrop);
		this.pnlContenedorPaneles.Controls.Add(this.pnlPreguntas);
		this.pnlContenedorPaneles.Dock = System.Windows.Forms.DockStyle.Fill;
		this.pnlContenedorPaneles.Location = new System.Drawing.Point(0, 75);
		this.pnlContenedorPaneles.Name = "pnlContenedorPaneles";
		this.pnlContenedorPaneles.Size = new System.Drawing.Size(1024, 693);
		this.pnlContenedorPaneles.TabIndex = 4;
		this.pnlArrastraOrdena.Anchor = System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Left | System.Windows.Forms.AnchorStyles.Right;
		this.pnlArrastraOrdena.BackColor = System.Drawing.Color.Transparent;
		this.pnlArrastraOrdena.BackgroundImageLayout = System.Windows.Forms.ImageLayout.Stretch;
		this.pnlArrastraOrdena.Controls.Add(this.pnlOrigenArrastrarOrdenar);
		this.pnlArrastraOrdena.Controls.Add(this.pnlDestinoArrastrarOrdenar);
		this.pnlArrastraOrdena.Location = new System.Drawing.Point(26, 8);
		this.pnlArrastraOrdena.Name = "pnlArrastraOrdena";
		this.pnlArrastraOrdena.Size = new System.Drawing.Size(976, 569);
		this.pnlArrastraOrdena.TabIndex = 15;
		this.pnlOrigenArrastrarOrdenar.AllowDrop = true;
		this.pnlOrigenArrastrarOrdenar.Anchor = System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Left;
		this.pnlOrigenArrastrarOrdenar.BackColor = System.Drawing.Color.WhiteSmoke;
		this.pnlOrigenArrastrarOrdenar.Location = new System.Drawing.Point(13, 17);
		this.pnlOrigenArrastrarOrdenar.Name = "pnlOrigenArrastrarOrdenar";
		this.pnlOrigenArrastrarOrdenar.Size = new System.Drawing.Size(380, 420);
		this.pnlOrigenArrastrarOrdenar.TabIndex = 5;
		this.pnlDestinoArrastrarOrdenar.AllowDrop = true;
		this.pnlDestinoArrastrarOrdenar.Anchor = System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Right;
		this.pnlDestinoArrastrarOrdenar.BackColor = System.Drawing.Color.WhiteSmoke;
		this.pnlDestinoArrastrarOrdenar.Location = new System.Drawing.Point(583, 17);
		this.pnlDestinoArrastrarOrdenar.Name = "pnlDestinoArrastrarOrdenar";
		this.pnlDestinoArrastrarOrdenar.Size = new System.Drawing.Size(380, 420);
		this.pnlDestinoArrastrarOrdenar.TabIndex = 6;
		this.PnlDragDropPanels.Anchor = System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Left | System.Windows.Forms.AnchorStyles.Right;
		this.PnlDragDropPanels.BackColor = System.Drawing.Color.White;
		this.PnlDragDropPanels.BackgroundImage = CulturaDigital.Properties.Resources.fondo_preguntas;
		this.PnlDragDropPanels.BackgroundImageLayout = System.Windows.Forms.ImageLayout.Stretch;
		this.PnlDragDropPanels.Controls.Add(this.flpOrdenamiento);
		this.PnlDragDropPanels.Location = new System.Drawing.Point(26, 8);
		this.PnlDragDropPanels.Name = "PnlDragDropPanels";
		this.PnlDragDropPanels.Size = new System.Drawing.Size(976, 573);
		this.PnlDragDropPanels.TabIndex = 10;
		this.flpOrdenamiento.AllowDrop = true;
		this.flpOrdenamiento.Anchor = System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Left | System.Windows.Forms.AnchorStyles.Right;
		this.flpOrdenamiento.Location = new System.Drawing.Point(49, 17);
		this.flpOrdenamiento.Name = "flpOrdenamiento";
		this.flpOrdenamiento.Size = new System.Drawing.Size(889, 527);
		this.flpOrdenamiento.TabIndex = 0;
		this.bgwCargarPregunta.WorkerReportsProgress = true;
		this.bgwCargarPregunta.WorkerSupportsCancellation = true;
		this.bgwCargarPregunta.DoWork += new System.ComponentModel.DoWorkEventHandler(bgwCargarPregunta_DoWork);
		this.bgwCargarPregunta.ProgressChanged += new System.ComponentModel.ProgressChangedEventHandler(bgwCargarPregunta_ProgressChanged);
		this.bgwCargarPregunta.RunWorkerCompleted += new System.ComponentModel.RunWorkerCompletedEventHandler(bgwCargarPregunta_RunWorkerCompleted);
		this.skinImage1.Scheme = CulturaDigital.SkinControls.Schemes.MacOs;
		base.AutoScaleDimensions = new System.Drawing.SizeF(6f, 13f);
		base.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
		this.BackColor = System.Drawing.Color.FromArgb(0, 52, 106);
		base.ClientSize = new System.Drawing.Size(1024, 768);
		base.Controls.Add(this.pnlContenedorPaneles);
		base.Controls.Add(this.pnlTitle);
		this.DoubleBuffered = true;
		base.FormBorderStyle = System.Windows.Forms.FormBorderStyle.None;
		base.Icon = (System.Drawing.Icon)resources.GetObject("$this.Icon");
		base.Name = "CulturaDigital_Examen";
		this.Text = "Examen";
		base.FormClosing += new System.Windows.Forms.FormClosingEventHandler(Examen_FormClosing);
		base.Load += new System.EventHandler(Examen_Load);
		this.pnlTitle.ResumeLayout(false);
		this.pnlTitle.PerformLayout();
		((System.ComponentModel.ISupportInitialize)this.pbHelp).EndInit();
		((System.ComponentModel.ISupportInitialize)this.pbtitulo).EndInit();
		this.pnlFooter.ResumeLayout(false);
		this.pnlContenedorTimmer.ResumeLayout(false);
		this.pnlContenedorTotales.ResumeLayout(false);
		this.pnlContenedorTotales.PerformLayout();
		this.pnlContenedorBotones.ResumeLayout(false);
		((System.ComponentModel.ISupportInitialize)this.pbSpinner).EndInit();
		this.pnlTextoPregunta.ResumeLayout(false);
		this.pnlTextoPregunta.PerformLayout();
		this.pnlDragDrop.ResumeLayout(false);
		this.pnlContenedorPaneles.ResumeLayout(false);
		this.pnlArrastraOrdena.ResumeLayout(false);
		this.PnlDragDropPanels.ResumeLayout(false);
		base.ResumeLayout(false);
	}
}
