using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Data;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Text;
using System.IO;
using System.Linq;
using System.Management;
using System.Net;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;
using System.Windows.Forms;
using System.Xml.Serialization;
using CulturaDigital.Helpers;
using CulturaDigital.Models;
using CulturaDigital.Models.Extensions;
using CulturaDigital.Properties;
using CulturaDigital.motor;
using CulturaDigital.xmn;

namespace CulturaDigital.Forms;

public class CulturaDigital_Inicio : Form
{
	private DateTime dFechaRelease = new DateTime(2019, 8, 15);

	private string appPath = Path.GetDirectoryName(Assembly.GetEntryAssembly().Location);

	private Usuario usuario = new Usuario();

	private Voucher voucher = new Voucher();

	private DateTime fechaServer = DateTime.Now;

	private List<Voucher> vouchers = new List<Voucher>();

	private bool fechaCorrecta;

	private bool enLinea;

	private bool existeExamen;

	private bool bLogin;

	private bool dbValida;

	private bool appValida;

	private bool mostrarAviso;

	private string URLAviso = "";

	private string avisoHTML = "";

	private string detalleExamen = "";

	private string userName = "";

	private string password = "";

	private List<Pregunta> preguntas = new List<Pregunta>();

	private Evaluacion evaluaasi = new Evaluacion();

	private int indexInstrucciones;

	private PrivateFontCollection _fonts = new PrivateFontCollection();

	public string UnikeID = "5e1dccde-4050-436b-a7ba-8ab95cba41c1";

	private int elegido;

	private bool iniciarSesion;

	private string versionExe = string.Empty;

	private const int WM_SYSCOMMAND = 274;

	private const int MOUSE_MOVE = 61458;

	private IContainer components;

	private Panel pnlTitle;

	private Button btnClose;

	private Panel pnlContenedorPaneles;

	private Panel PnlBienvenido;

	private Panel pnlInfoReview;

	private Panel pnlimagencelular;

	private PictureBox LoginPictureBox;

	private TextBox txtContrasenia;

	private TextBox txtUsuario;

	private Label label1;

	private Label lblModalidad;

	private PictureBox pblogin1;

	private Label lblVersion;

	private Button btnLogin;

	private Label label7;

	private PictureBox pictureBox2;

	private Label lblTiempoEvaluacion;

	private Label label15;

	private Label label14;

	private Label lblNombreTipoAplicacion;

	private Label label9;

	private Label lblCantidadPreguntas;

	private Label lblTipoAplicacion;

	private Label lblNombreCompleto;

	private Label label4;

	private Label label3;

	private Label label11;

	private Label label10;

	private Label label8;

	private Label label6;

	private Label label5;

	private Label label2;

	private Button btnRegresarBienvenido;

	private Label label23;

	private Label label12;

	private PictureBox pictureBox3;

	private Label label22;

	private Label label20;

	private Label label25;

	private Label label24;

	private Label label21;

	private Label label18;

	private Label label19;

	private Label label16;

	private Label lblCURPUsuario;

	private Label lblCorreoUsuario;

	private Label lblNombreUsuario;

	private Label lblPerfilUsuario;

	private Label lblModalidadUsuario;

	private Label lblFecha;

	private Label lblOportunidadNo;

	private Label label17;

	private Label label13;

	private Label label26;

	private CheckBox cbAvisoPrivacidad;

	private Button btnNo;

	private Button btnSi;

	private Label label27;

	private Label label28;

	private Panel PnlInstrucciones;

	private Label lblTituloInformacionControles;

	private PictureBox pictureBox4;

	private Panel pnlInfoControlesButtons;

	private Label label30;

	private Label label31;

	private Label label32;

	private Label label33;

	private Label label35;

	private Label label34;

	private Label label36;

	private Label label37;

	private Label label38;

	private Label label39;

	private Button btnAnterior;

	private Button btnSiguiente;

	private Panel pnlInfoControlesArrastrar;

	private Label label55;

	private PictureBox pictureBox5;

	private Label label57;

	public Panel pnlLogin;

	public BackgroundWorker bgwLoad;

	public BackgroundWorker bgwLoadQuestions;

	private Button btnContinuarBienvenido;

	private Panel pnlImportante;

	private Label label61;

	private Label label65;

	private PictureBox pbSpinner;

	private Button btnOmitir;

	private Button btnReiniciar;

	private Button btnFinalizar;

	private PictureBox pbtitulo;

	private Panel pnlInfoControlesReloj;

	private Panel pnlContenedorTotales;

	private Label label40;

	private Label label50;

	private Label label43;

	private Button btnResueltasCount;

	private Button btnRestantesCount;

	private Button btnOmitidasCount;

	private Panel pnlContenedorTimmer;

	private Label lblMinutos;

	private Label label44;

	private Label label49;

	private Label label45;

	private Label label46;

	private Label label47;

	private Label label48;

	private Label label29;

	private Label label62;

	private Label label67;

	private Label label64;

	private Button btnAceptarAviso;

	private PictureBox pictureBox9;

	private PictureBox pictureBox8;

	private PictureBox pictureBox7;

	private Label label41;

	private Label label42;

	private Label label51;

	private Label label59;

	private Label label53;

	private Label label63;

	private Label label52;

	private Label label54;

	private Label label56;

	private Label label68;

	private Label label69;

	private Label label70;

	private Label label60;

	private Label cubiertaLbl;

	public CulturaDigital_Inicio()
	{
		SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.DoubleBuffer, value: true);
		SetStyle(ControlStyles.UserPaint, value: true);
		InitializeComponent();
		SetDoubleBuffered(pnlContenedorPaneles);
		SetDoubleBuffered(pnlLogin);
		SetDoubleBuffered(pnlContenedorTimmer);
		SetDoubleBuffered(pnlContenedorTotales);
		SetDoubleBuffered(PnlBienvenido);
		SetDoubleBuffered(PnlInstrucciones);
		SetDoubleBuffered(pnlInfoControlesButtons);
		SetDoubleBuffered(pnlImportante);
		SetDoubleBuffered(pnlInfoControlesReloj);
		SetDoubleBuffered(pnlInfoReview);
		base.MouseMove += Form1_MouseMove;
		pnlTitle.MouseMove += Form1_MouseMove;
		lblVersion.MouseMove += Form1_MouseMove;
		pbtitulo.MouseMove += Form1_MouseMove;
	}

	private void Inicio_Load(object sender, EventArgs e)
	{
		Helper.Clean(appPath, Application.ProductVersion);
		if (ValidaVersion())
		{
			MessageBox.Show("Por favor inicie sesión para validar el/los exámenes que tenga asignados", "", MessageBoxButtons.OK, MessageBoxIcon.Asterisk);
			bgwLoad.RunWorkerAsync();
			if (existeExamen)
			{
				CargaImagenes();
			}
			if (File.Exists("DS-DIGI.TTF"))
			{
				_fonts.AddFontFile("DS-DIGI.TTF");
				lblMinutos.Font = new Font(_fonts.Families[0], 27.75f);
				btnResueltasCount.Font = new Font(_fonts.Families[0], 24.75f);
				btnRestantesCount.Font = new Font(_fonts.Families[0], 24.75f);
				btnOmitidasCount.Font = new Font(_fonts.Families[0], 24.75f);
			}
			lblVersion.Text = "Versión " + Application.ProductVersion;
			pnlLogin.Dock = DockStyle.Fill;
			pnlLogin.Visible = true;
			pnlLogin.BringToFront();
			if (existeExamen)
			{
				bgwLoadQuestions.RunWorkerAsync();
			}
			"Se ha iniciado el examen".Bitacora("000001", "Inicio", "Inicio", "000047", "000001");
		}
		else
		{
			if (!appValida)
			{
				Process.Start($"ExamenV{versionExe}.exe");
			}
			Close();
			Process.GetCurrentProcess().Kill();
			Application.Exit();
			Environment.Exit(0);
		}
	}

	private void txtUsuario_TextChanged(object sender, EventArgs e)
	{
	}

	private void button1_Click_1(object sender, EventArgs e)
	{
		AvisoPrivacidad avisoPrivacidad = new AvisoPrivacidad();
		if (usuario.MostrarAviso == 1)
		{
			avisoPrivacidad.btnNo.Visible = true;
		}
		else if (usuario.MostrarAviso == 0)
		{
			avisoPrivacidad.btnNo.Visible = false;
		}
		usuario.MostrarAviso = 1;
		if (enLinea)
		{
			avisoPrivacidad.wb1.Navigate(URLAviso);
		}
		else
		{
			avisoPrivacidad.wb1.DocumentText = avisoHTML;
		}
		DialogResult dialogResult = avisoPrivacidad.ShowDialog(this);
		if (usuario.MostrarAviso == 1 && dialogResult == DialogResult.OK)
		{
			btnSi.Visible = true;
			btnAceptarAviso.Image = Resources.checkbtn;
		}
		else if (usuario.MostrarAviso == 1 && dialogResult != DialogResult.OK)
		{
			btnAceptarAviso.Image = Resources.whitout;
			btnSi.Visible = false;
		}
		else if (usuario.MostrarAviso == 0)
		{
			btnAceptarAviso.Image = Resources.checkbtn;
		}
		avisoPrivacidad.Dispose();
	}

	private void btnLogin_Click(object sender, EventArgs e)
	{
		try
		{
			pbSpinner.Image = Resources.spn3;
			pbSpinner.Visible = true;
			pbSpinner.BackgroundImageLayout = ImageLayout.Center;
			pbSpinner.BringToFront();
			userName = txtUsuario.Text;
			password = txtContrasenia.Text;
			txtUsuario.Text = "";
			txtContrasenia.Text = "";
			"Intento de inicio de sesión                               ".Bitacora("000002", "Inicio", "Login ", "000324", "000002");
			if (!string.IsNullOrEmpty(userName) && !string.IsNullOrEmpty(password))
			{
				if (new Helper().Conexion())
				{
					if (!existeExamen)
					{
						try
						{
							List<Licencia> list = new List<Licencia>();
							using (MotorUniversalSoapClient motorUniversalSoapClient = new MotorUniversalSoapClient())
							{
								list = motorUniversalSoapClient.ExamenesDisponibles(userName).ToList();
							}
							if (list.Count() > 0)
							{
								if (list.Count() == 1)
								{
									DatosEvaluacion.IdAplicacion = list.FirstOrDefault().Id.ToString();
									DatosEvaluacion.Nombre = list.FirstOrDefault().Nombre;
									DatosEvaluacion.Letra = list.FirstOrDefault().Letra;
									DatosEvaluacion.Examen = list.FirstOrDefault().NombreArchivo;
									DatosEvaluacion.Licencia = list.FirstOrDefault().NombreLicencia;
								}
								else
								{
									DatosEvaluacion.Opciones = new string[list.Count, 5];
									int num = 0;
									foreach (Licencia item in list)
									{
										DatosEvaluacion.Opciones[num, 0] = item.Nombre;
										DatosEvaluacion.Opciones[num, 1] = item.NombreArchivo;
										DatosEvaluacion.Opciones[num, 2] = item.NombreLicencia;
										DatosEvaluacion.Opciones[num, 3] = item.Id.ToString();
										DatosEvaluacion.Opciones[num, 4] = item.Letra;
										num++;
									}
									new Seleccionar("Parece que cuenta con más de un examen disponible", "seleccione el examen que desea realizar").ShowDialog();
								}
								if (!string.IsNullOrEmpty(DatosEvaluacion.Examen) || DatosEvaluacion.Examen != "")
								{
									if (!ValidaExistencia(DatosEvaluacion.IdAplicacion))
									{
										if (DescargaExamen(int.Parse(DatosEvaluacion.IdAplicacion)))
										{
											existeExamen = ProcesaArchivo();
											iniciarSesion = true;
											bgwLoadQuestions.RunWorkerAsync();
										}
									}
									else
									{
										existeExamen = ProcesaArchivo();
										iniciarSesion = true;
										bgwLoadQuestions.RunWorkerAsync();
									}
								}
								else
								{
									"No selecciona exammen                 ".Bitacora("000005", "Inicio", "Error ", "000277", "000007");
									Application.Exit();
								}
							}
							else
							{
								Question question = new Question();
								"Error en usuario ingresado                 ".Bitacora("000005", "Inicio", "Error ", "000277", "000007");
								question.lblTitulo.Text = "Evaluaasi";
								question.lblDetalle.Text = "El usuario no existe o no cuenta con voucher para realizar examen";
								question.btnSi.Visible = false;
								question.btnNo.Visible = false;
								question.ShowDialog();
							}
						}
						catch (Exception)
						{
							Question question2 = new Question();
							"Error al descargar examen                 ".Bitacora("000005", "Inicio", "Error ", "000277", "000007");
							question2.lblTitulo.Text = "Evaluaasi";
							question2.lblDetalle.Text = "Ocurrió un error al validar el/los exámenes correspondientes al usuario";
							question2.btnSi.Visible = false;
							question2.btnNo.Visible = false;
							question2.ShowDialog();
						}
					}
					else
					{
						IniciaSesion();
					}
				}
				else
				{
					Question question3 = new Question();
					"No cuenta con conexióna internet                 ".Bitacora("000005", "Inicio", "Error ", "000277", "000007");
					question3.lblTitulo.Text = "Evaluaasi";
					question3.lblDetalle.Text = "No cuenta con conexión a internet, por favor revise su conexión y vuelva a intentarlo";
					question3.btnSi.Visible = false;
					question3.btnNo.Visible = false;
					question3.ShowDialog();
				}
			}
			else
			{
				Question question4 = new Question();
				"Nombre o contraseña en blanco                 ".Bitacora("000005", "Inicio", "Error ", "000277", "000007");
				question4.lblTitulo.Text = "Evaluaasi";
				question4.lblDetalle.Text = "Por favor, ingrese el usuario y contraseña";
				question4.btnSi.Visible = false;
				question4.btnNo.Visible = false;
				question4.ShowDialog();
			}
		}
		catch (Exception ex2)
		{
			Question question5 = new Question();
			ex2.Message.Bitacora("000005", "Inicio", "Error ", "000277", "000007");
			question5.lblTitulo.Text = "Evaluaasi";
			question5.lblDetalle.Text = "Ocurrió un error, por favor verifique que los datos ingresados sean correctos";
			question5.btnSi.Visible = false;
			question5.btnNo.Visible = false;
			question5.ShowDialog();
		}
		pbSpinner.Visible = false;
		pbSpinner.SendToBack();
	}

	private void btnClose_Click(object sender, EventArgs e)
	{
		Application.Exit();
	}

	private void btnContinuarBienvenido_Click(object sender, EventArgs e)
	{
		BooleanExtensions.IniciarPanel(visible: true, ref pnlInfoReview);
		DateTime now = DateTime.Now;
		lblOportunidadNo.Text = voucher.NoOportunidad.NoOportunidad();
		lblFecha.Text = now.Day.PonerCeros(2) + "/" + now.Month.PonerCeros(2) + "/" + now.Year.PonerCeros(4) + " " + now.Hour.PonerCeros(2) + ":" + now.Minute.PonerCeros(2) + ":" + now.Second.PonerCeros(2);
		lblModalidadUsuario.Text = "";
		lblPerfilUsuario.Text = usuario.Perfil;
		lblNombreUsuario.Text = usuario.Nombre + " " + usuario.Apellido;
		lblCorreoUsuario.Text = usuario.UsuarioEmail;
		lblCURPUsuario.Text = usuario.CURP;
	}

	private void btnRegresarBienvenido_Click(object sender, EventArgs e)
	{
		pnlLogin.Visible = true;
		pnlLogin.BringToFront();
	}

	private void checkBox1_CheckedChanged(object sender, EventArgs e)
	{
		if (usuario.MostrarAviso == 1 && cbAvisoPrivacidad.Checked)
		{
			AvisoPrivacidad avisoPrivacidad = new AvisoPrivacidad();
			if (enLinea)
			{
				avisoPrivacidad.wb1.Navigate(URLAviso);
			}
			else
			{
				avisoPrivacidad.wb1.DocumentText = avisoHTML;
			}
			if (avisoPrivacidad.ShowDialog(this) == DialogResult.OK)
			{
				btnSi.Visible = true;
			}
			else
			{
				btnSi.Visible = false;
			}
			avisoPrivacidad.Dispose();
		}
		else
		{
			btnSi.Visible = true;
		}
	}

	private void btnRegresarBienvenido_Click_1(object sender, EventArgs e)
	{
		pnlLogin.BringToFront();
	}

	private void btnContinuarBienvenido_Click_1(object sender, EventArgs e)
	{
		DateTime now = DateTime.Now;
		lblOportunidadNo.Text = voucher.NoOportunidad.NoOportunidad();
		lblFecha.Text = now.Day.PonerCeros(2) + "/" + now.Month.PonerCeros(2) + "/" + now.Year.PonerCeros(4) + " " + now.Hour.PonerCeros(2) + ":" + now.Minute.PonerCeros(2) + ":" + now.Second.PonerCeros(2);
		lblModalidadUsuario.Text = (enLinea ? "En línea" : "Fuera de línea");
		lblPerfilUsuario.Text = usuario.Perfil;
		lblNombreUsuario.Text = usuario.Nombre + " " + usuario.Apellido;
		lblCorreoUsuario.Text = usuario.UsuarioEmail;
		lblCURPUsuario.Text = usuario.CURP;
		pnlInfoReview.BringToFront();
	}

	private void btnNo_Click_1(object sender, EventArgs e)
	{
		PnlBienvenido.BringToFront();
	}

	private void btnSi_Click_1(object sender, EventArgs e)
	{
		PnlInstrucciones.BringToFront();
		pnlInfoControlesButtons.BringToFront();
		indexInstrucciones = 1;
	}

	private void button1_Click(object sender, EventArgs e)
	{
		indexInstrucciones--;
		btnSiguiente.Text = "Siguiente";
		switch (indexInstrucciones)
		{
		case 0:
			pnlInfoReview.BringToFront();
			break;
		case 1:
			pnlInfoControlesButtons.BringToFront();
			break;
		case 2:
			lblTituloInformacionControles.Text = "Información sobre los controles:";
			pnlInfoControlesReloj.BringToFront();
			break;
		case 3:
			lblTituloInformacionControles.Text = "Información sobre las preguntas:";
			pnlInfoControlesArrastrar.BringToFront();
			break;
		case 4:
			lblTituloInformacionControles.Text = "¡Importante!";
			btnSiguiente.Text = "Iniciar";
			pnlImportante.BringToFront();
			break;
		}
	}

	private void btnSiguiente_Click(object sender, EventArgs e)
	{
		indexInstrucciones++;
		switch (indexInstrucciones)
		{
		case 2:
			lblTituloInformacionControles.Text = "Información sobre los controles:";
			pnlInfoControlesReloj.BringToFront();
			break;
		case 3:
			lblTituloInformacionControles.Text = "Información sobre las preguntas:";
			pnlInfoControlesArrastrar.BringToFront();
			break;
		case 4:
			lblTituloInformacionControles.Text = "¡Importante!";
			pnlImportante.BringToFront();
			btnSiguiente.Text = "Iniciar";
			break;
		case 5:
		{
			Question question = new Question();
			string text = "";
			question.lblTitulo.Text = "Evaluaasi";
			text = "A partir de este momento iniciarás el examen" + Environment.NewLine + Environment.NewLine;
			text = text + "Si estás seguro da clic en el botón Si, en caso contrario da clic en el botón No." + Environment.NewLine;
			text += "Si continúas o interrumpes tu examen habrás perdido una oportunidad.";
			question.lblDetalle.Text = text;
			question.Height = 250;
			if (question.ShowDialog() == DialogResult.OK)
			{
				string text2 = new Helper().ObtenerMAC();
				string text3 = new Helper().ObtenerIP();
				base.Visible = false;
				using (UsuarioSoapClient usuarioSoapClient = new UsuarioSoapClient())
				{
					if (int.Parse(usuarioSoapClient.Inicio(voucher.VoucherId, Environment.UserName, Environment.MachineName, text3, text2, "2000", Application.ProductVersion, usuario.SubSistema, 1).Rows[0][0].ToString()) == 0)
					{
						"No se ha podido iniciar el examen                         ".Bitacora("000007", "Examen", "Examen", "000487", "000009");
						text = "";
						question.lblTitulo.Text = "Evaluaasi";
						text = "No ha sido posible iniciar el examen." + Environment.NewLine;
						text = text + "Por favor verifique su conexión a internet y vuelva a intentarlo." + Environment.NewLine + Environment.NewLine;
						text = text + "Si sigue presentando inconvenientes por favor contacte a soporte técnico" + Environment.NewLine + "                             01 (800) 808 6240   " + Environment.NewLine + "soporte@grupoeduit.com";
						question.lblDetalle.Text = text;
						question.btnSi.Visible = false;
						question.btnNo.Visible = false;
						question.ShowDialog();
						Application.Exit();
					}
				}
				"Inicia examen                                             ".Bitacora("000006", "Examen", "Examen", "000500", "000008");
				CulturaDigital_Examen culturaDigital_Examen = new CulturaDigital_Examen();
				culturaDigital_Examen.NombreUsuarioPC = Environment.UserName;
				culturaDigital_Examen.NombrePC = Environment.MachineName;
				culturaDigital_Examen.DireccionIP = text3;
				culturaDigital_Examen.DireccionMAC = text2;
				culturaDigital_Examen.User = usuario;
				culturaDigital_Examen.VersionAplicacion = lblVersion.Text;
				culturaDigital_Examen.V = voucher;
				culturaDigital_Examen.evaluaasi = evaluaasi;
				preguntas = evaluaasi.Preguntas;
				preguntas.Shuffle();
				if (preguntas.Count((Pregunta q) => q.TipoPregunta == eTipoPregunta.Ordenamiento) > 0)
				{
					while (preguntas.FirstOrDefault().TipoPregunta == eTipoPregunta.Ordenamiento)
					{
						preguntas.Shuffle();
					}
				}
				evaluaasi.Preguntas = preguntas;
				culturaDigital_Examen.evaluaasi.Preguntas = evaluaasi.Preguntas;
				culturaDigital_Examen.InLine = enLinea;
				culturaDigital_Examen.FechaInicio = GetFecha();
				if (fechaCorrecta)
				{
					culturaDigital_Examen.fechaEnLinea = true;
				}
				try
				{
					switch (culturaDigital_Examen.ShowDialog())
					{
					case DialogResult.OK:
					{
						_ = culturaDigital_Examen.V.Resultado;
						CulturaDigital_Finalizar culturaDigital_Finalizar = new CulturaDigital_Finalizar();
						string[] files = Directory.GetFiles(appPath + "\\Resultados\\", voucher.VoucherCode + "*.txt");
						string text4 = "";
						string filename = string.Concat(str2: (files.Count() <= 1) ? voucher.VoucherCode : (voucher.VoucherCode + "(" + (files.Count() - 1) + ")"), str0: appPath, str1: "\\Constancias\\", str3: ".png");
						culturaDigital_Finalizar.lblVersion.Text = lblVersion.Text;
						culturaDigital_Finalizar.lblVoucher.Text = "Voucher : " + voucher.VoucherCode;
						culturaDigital_Finalizar.imagePanel1.Image = (Bitmap)Image.FromFile(filename);
						culturaDigital_Finalizar.imagePanel1.BackgroundImageLayout = ImageLayout.Center;
						culturaDigital_Finalizar.imagePanel1.Zoom = 0.19999999f;
						culturaDigital_Finalizar.trackBar1.Value = 10;
						culturaDigital_Finalizar.Ruta = appPath;
						culturaDigital_Finalizar.ShowDialog();
						"Cerrar aplicación                                         ".Bitacora("000010", "Inicio", "Fin   ", "000522", "000018");
						Application.Exit();
						break;
					}
					case DialogResult.Yes:
						"Cerrar aplicación por usuario                             ".Bitacora("000010", "Inicio", "Fin   ", "000527", "000019");
						base.Visible = true;
						break;
					case DialogResult.Abort:
						text = "";
						question.lblTitulo.Text = "Evaluaasi";
						text = "Sus resultados los puede encontrar en las rutas " + Environment.NewLine + Environment.NewLine;
						text = text + appPath + "\\Constancias" + Environment.NewLine;
						text = text + appPath + "\\Resultados" + Environment.NewLine;
						question.lblDetalle.Text = text;
						question.btnSi.Visible = false;
						question.btnNo.Visible = false;
						question.ShowDialog();
						"Cerrar aplicación - Abortada                              ".Bitacora("000010", "Inicio", "Fin   ", "000541", "000020");
						Application.Exit();
						break;
					default:
						"Cerrar aplicación - Unknow                                ".Bitacora("000010", "Inicio", "Fin   ", "000546", "000021");
						Application.Exit();
						break;
					}
					break;
				}
				catch (Exception)
				{
					break;
				}
			}
			text = "";
			question.lblTitulo.Text = "Evaluaasi";
			text = "Debido a que declinaste comenzar el examen, la aplicación se cerrará." + Environment.NewLine;
			text = text + "NO has perdido tu oportunidad, puedes aplicar el examen cuando desees." + Environment.NewLine + Environment.NewLine;
			text += "¡Hasta luego!";
			question.lblDetalle.Text = text;
			question.btnSi.Visible = false;
			question.btnNo.Visible = false;
			question.ShowDialog();
			Application.Exit();
			break;
		}
		}
	}

	private void cbAvisoPrivacidad_CheckedChanged(object sender, EventArgs e)
	{
		if (mostrarAviso)
		{
			AvisoPrivacidad avisoPrivacidad = new AvisoPrivacidad();
			if (usuario.MostrarAviso == 1 && cbAvisoPrivacidad.Checked)
			{
				avisoPrivacidad.btnNo.Visible = true;
			}
			else
			{
				avisoPrivacidad.btnNo.Visible = false;
			}
			if (enLinea)
			{
				avisoPrivacidad.wb1.Navigate(URLAviso);
			}
			else
			{
				avisoPrivacidad.wb1.DocumentText = avisoHTML;
			}
			if (avisoPrivacidad.ShowDialog(this) == DialogResult.OK)
			{
				btnSi.Visible = true;
				cbAvisoPrivacidad.Checked = true;
			}
			else
			{
				btnSi.Visible = false;
			}
			avisoPrivacidad.Dispose();
		}
	}

	private void bgwLoad_DoWork(object sender, DoWorkEventArgs e)
	{
		bgwLoad.ReportProgress(-1, $"Cargando componentes");
		try
		{
			fechaServer = DateTime.Now;
			if (dFechaRelease < fechaServer)
			{
				fechaCorrecta = true;
			}
			else
			{
				fechaCorrecta = false;
			}
			if (new Helper().Conexion())
			{
				enLinea = true;
				return;
			}
			enLinea = false;
			existeExamen = false;
			bgwLoad.ReportProgress(-1, $"No cuenta con una conexión a internet estable.");
			bgwLoad.CancelAsync();
		}
		catch (Exception)
		{
			enLinea = false;
			fechaCorrecta = false;
			bgwLoad.ReportProgress(-1, $"No ha sido posible establecer conexión de internet");
			bgwLoad.CancelAsync();
		}
	}

	private void bgwLoad_ProgressChanged(object sender, ProgressChangedEventArgs e)
	{
		if (e.UserState is string)
		{
			lblModalidad.Text = (string)e.UserState;
		}
	}

	private void bgwLoad_RunWorkerCompleted(object sender, RunWorkerCompletedEventArgs e)
	{
		btnLogin.Enabled = true;
		if (!fechaCorrecta)
		{
			Question question = new Question();
			string text = "";
			question.lblTitulo.Text = "Evaluaasi";
			text = "La fecha que tiene en su pc no es correcta." + Environment.NewLine + Environment.NewLine;
			text = text + "La aplicación se cerrará, por favor revisa la fecha de tu equipo y corrígela antes de continuar." + Environment.NewLine + Environment.NewLine;
			text += "Si tienes dudas puedes contactar a soporte técnico al 01 (800) 808 6240 o escribe al correo: soporte@grupoeduit.com";
			question.lblDetalle.Text = text;
			question.Height = 350;
			question.btnNo.Visible = false;
			question.btnSi.Visible = false;
			if (question.ShowDialog() == DialogResult.Cancel)
			{
				Close();
			}
			else
			{
				Application.Exit();
			}
		}
		if (enLinea)
		{
			lblModalidad.Text = "";
		}
		else if (!enLinea)
		{
			Question question2 = new Question();
			string text2 = "";
			question2.lblTitulo.Text = "Evaluaasi";
			text2 = "Para poder trabajar se debe contar con una conexión estable a internet, revisa tu conexión y vuelve a intentarlo." + Environment.NewLine + Environment.NewLine;
			text2 += "Si tienes dudas puedes contactar a soporte técnico al 01 (800) 808 6240 o escribe al correo: soporte@grupoeduit.com";
			question2.lblDetalle.Text = text2;
			question2.Height = 350;
			question2.btnNo.Visible = false;
			question2.btnSi.Visible = false;
			if (question2.ShowDialog() == DialogResult.Cancel)
			{
				Close();
			}
			else
			{
				Application.Exit();
			}
		}
	}

	private void bgwLoadQuestions_DoWork(object sender, DoWorkEventArgs e)
	{
		try
		{
			if (new Helper().Conexion())
			{
				if (existeExamen)
				{
					bgwLoadQuestions.ReportProgress(-1, "Validando que se cuente con la versión más reciente del archivo de preguntas");
					using MotorUniversalSoapClient motorUniversalSoapClient = new MotorUniversalSoapClient();
					dbValida = evaluaasi.Version.ComparaVersionDB(motorUniversalSoapClient.VersionExamen(int.Parse(DatosEvaluacion.IdAplicacion)));
				}
				int num = 1;
				if (!dbValida)
				{
					while (true)
					{
						if (num < 4)
						{
							bgwLoadQuestions.ReportProgress(-1, "No se cuenta con la versión más reciente del archivo de preguntas");
							bgwLoadQuestions.ReportProgress(-1, $"Se descargará el nuevo archivo de preguntas (intento {num}/3)");
							if (DescargaExamen(int.Parse(DatosEvaluacion.IdAplicacion)))
							{
								bgwLoadQuestions.ReportProgress(-1, "Se descargó el nuevo archivo de preguntas");
								existeExamen = ProcesaArchivo();
								break;
							}
							bgwLoadQuestions.ReportProgress(-1, "No fue posible descargar el nuevo archivo de preguntas, se intentará nuevamente");
							num++;
							continue;
						}
						existeExamen = false;
						bgwLoadQuestions.ReportProgress(-1, "No fue posible descargar el nuevo archivo de preguntas");
						e.Cancel = true;
						e.Result = "Por favor verifique su conexión a internet";
						bgwLoadQuestions.CancelAsync();
						break;
					}
				}
			}
			try
			{
				if (!File.Exists(Path.Combine(appPath, "apv1.apxaem")) && new Helper().Conexion())
				{
					using WebClient webClient = new WebClient();
					webClient.DownloadFile("https://acemsstorage.blob.core.windows.net/conocer/MotorUniversal/Examen/apv1.apxaem", "apv1.apxaem");
				}
				StreamReader streamReader = new StreamReader(Path.Combine(appPath, "apv1.apxaem"));
				avisoHTML = streamReader.ReadToEnd();
			}
			catch (Exception ex)
			{
				existeExamen = false;
				bgwLoadQuestions.ReportProgress(-1, $"No ha sido posible cargar el aviso de privacidad");
				e.Cancel = true;
				e.Result = ex.Message;
				bgwLoadQuestions.CancelAsync();
			}
			evaluaasi.VersionApp = versionExe;
			if (existeExamen)
			{
				if (DatosEvaluacion.Licencia.EsAlguno("ECM0294.dat", "ECM0121.dat", "ECM0120.dat"))
				{
					if (DatosEvaluacion.Licencia.Equals("ECM0294.dat"))
					{
						evaluaasi.Preguntas = evaluaasi.Preguntas.Where((Pregunta q) => q.Mostrar == eMostrar.Examen).Take(31).ToList();
						return;
					}
					if (DatosEvaluacion.Licencia.Equals("ECM0121.dat"))
					{
						List<Pregunta> list = new List<Pregunta>();
						int num2 = 0;
						foreach (Categoria categoria in evaluaasi.Categorias)
						{
							foreach (Tema t in categoria.Temas)
							{
								try
								{
									int num3 = evaluaasi.Preguntas.Where((Pregunta q) => q.TemaId == t.TemaId && q.Mostrar == eMostrar.Examen).ToList().Max((Pregunta q) => q.NoPregunta);
									int numero = ((num3 == 1) ? 1 : new Random().Next(1, num3 + 1));
									if (num3 != 1)
									{
										while (numero == num2)
										{
											numero = new Random().Next(1, num3 + 1);
										}
									}
									list.Add(evaluaasi.Preguntas.Where((Pregunta q) => q.TemaId == t.TemaId && q.Mostrar == eMostrar.Examen && q.NoPregunta == numero).FirstOrDefault());
									num2 = numero;
								}
								catch (Exception)
								{
								}
							}
						}
						evaluaasi.Preguntas = list;
						return;
					}
					int[] array = new int[18]
					{
						3, 2, 1, 3, 1, 2, 1, 3, 2, 1,
						2, 3, 2, 1, 3, 2, 3, 1
					};
					int ant = ObtieneEscenarioAnterior();
					int num4 = new Random().Next(0, array.Length);
					int escenario = ValidarEscenario(array, ant, array[num4]);
					GuardarEscenario(escenario);
					if (escenario != 3)
					{
						evaluaasi.Preguntas = evaluaasi.Preguntas.Where((Pregunta q) => q.Mostrar == eMostrar.Examen && q.NoPregunta == escenario).ToList();
						return;
					}
					List<Pregunta> list2 = new List<Pregunta>();
					int num5 = 0;
					foreach (Categoria categoria2 in evaluaasi.Categorias)
					{
						foreach (Tema t2 in categoria2.Temas)
						{
							try
							{
								int num6 = evaluaasi.Preguntas.Where((Pregunta q) => q.TemaId == t2.TemaId && q.Mostrar == eMostrar.Examen).ToList().Max((Pregunta q) => q.NoPregunta);
								int numero2 = ((num6 == 1) ? 1 : new Random().Next(1, num6 + 1));
								if (num6 != 1)
								{
									while (numero2 == num5)
									{
										numero2 = new Random().Next(1, num6 + 1);
									}
								}
								list2.Add(evaluaasi.Preguntas.Where((Pregunta q) => q.TemaId == t2.TemaId && q.Mostrar == eMostrar.Examen && q.NoPregunta == numero2).FirstOrDefault());
								num5 = numero2;
							}
							catch (Exception)
							{
							}
						}
					}
					evaluaasi.Preguntas = list2;
					return;
				}
				int num7 = 0;
				foreach (Categoria categoria3 in evaluaasi.Categorias)
				{
					num7 += categoria3.Temas.Count;
				}
				int num8 = 30 / num7;
				int escenario2 = 0;
				if (num8 == 1)
				{
					int[] array2 = new int[18]
					{
						3, 2, 1, 3, 1, 2, 1, 3, 2, 1,
						2, 3, 2, 1, 3, 2, 3, 1
					};
					int ant2 = ObtieneEscenarioAnterior();
					int num9 = new Random().Next(0, array2.Length);
					escenario2 = ValidarEscenario(array2, ant2, array2[num9]);
					GuardarEscenario(escenario2);
				}
				else
				{
					escenario2 = 3;
				}
				if (escenario2 != 3)
				{
					evaluaasi.Preguntas = evaluaasi.Preguntas.Where((Pregunta q) => q.Mostrar == eMostrar.Examen && q.NoPregunta == escenario2).ToList();
					return;
				}
				List<Pregunta> list3 = new List<Pregunta>();
				if (num8 == 1)
				{
					int num10 = 0;
					foreach (Categoria categoria4 in evaluaasi.Categorias)
					{
						foreach (Tema t3 in categoria4.Temas)
						{
							try
							{
								int num11 = evaluaasi.Preguntas.Where((Pregunta q) => q.TemaId == t3.TemaId && q.Mostrar == eMostrar.Examen).ToList().Max((Pregunta q) => q.NoPregunta);
								int numero3 = ((num11 == 1) ? 1 : new Random().Next(1, num11 + 1));
								if (num11 != 1)
								{
									while (numero3 == num10)
									{
										numero3 = new Random().Next(1, num11 + 1);
									}
								}
								list3.Add(evaluaasi.Preguntas.Where((Pregunta q) => q.TemaId == t3.TemaId && q.Mostrar == eMostrar.Examen && q.NoPregunta == numero3).FirstOrDefault());
								num10 = numero3;
							}
							catch (Exception)
							{
							}
						}
					}
				}
				else
				{
					foreach (Categoria categoria5 in evaluaasi.Categorias)
					{
						foreach (Tema t4 in categoria5.Temas)
						{
							int num12 = evaluaasi.Preguntas.Where((Pregunta q) => q.Mostrar == eMostrar.Examen && q.TemaId == t4.TemaId).Count();
							int num13 = ((num12 > num8) ? num12 : num8);
							List<int> list4 = new List<int>();
							for (int num14 = 0; num14 < num8; num14++)
							{
								int numeroPregunta = new Random().Next(1, num13 + 1);
								while (list4.Contains(numeroPregunta))
								{
									numeroPregunta = new Random().Next(1, num13 + 1);
								}
								Pregunta item = evaluaasi.Preguntas.Where((Pregunta q) => q.TemaId == t4.TemaId && q.Mostrar == eMostrar.Examen && q.NoPregunta == numeroPregunta).FirstOrDefault();
								list3.Add(item);
								list4.Add(numeroPregunta);
							}
						}
					}
				}
				evaluaasi.Preguntas = list3;
			}
			else
			{
				bgwLoadQuestions.CancelAsync();
			}
		}
		catch (Exception ex5)
		{
			existeExamen = false;
			bgwLoadQuestions.ReportProgress(-1, $"No ha sido posible cargar la base de datos de preguntas.");
			e.Cancel = true;
			e.Result = ex5.Message;
			bgwLoadQuestions.CancelAsync();
		}
	}

	private void bgwLoadQuestions_ProgressChanged(object sender, ProgressChangedEventArgs e)
	{
		if (e.UserState is string)
		{
			lblModalidad.Text = (string)e.UserState;
		}
	}

	private void bgwLoadQuestions_RunWorkerCompleted(object sender, RunWorkerCompletedEventArgs e)
	{
		Question question = new Question();
		Cursor.Current = Cursors.Default;
		pbSpinner.Image = null;
		pbSpinner.Visible = false;
		if (e.Cancelled && !existeExamen)
		{
			try
			{
				question.lblTitulo.Text = "Evaluaasi";
				string text = "No ha sido posible cargar algunos complementos importantes para esta aplicación." + Environment.NewLine + Environment.NewLine;
				if (enLinea)
				{
					text = text + "Por favor verifica tu conexión a internet." + Environment.NewLine + Environment.NewLine;
				}
				else
				{
					text = text + "La aplicación se cerrará, antes de volver a intentar, por favor verifica que cuentes con los siguientes archivos en la misma carpeta de la aplicación:" + Environment.NewLine;
					text = text + "• " + DatosEvaluacion.IdAplicacion + ".xea" + Environment.NewLine;
					text = text + "• apv1.apxaem" + Environment.NewLine + Environment.NewLine;
				}
				text = text + "Si tienes alguna duda puedes contactar a soporte técnico al 01 (800) 808 6240 o al correo soporte@grupoeduit.com" + Environment.NewLine;
				question.lblDetalle.Text = text;
				question.Height = 400;
				question.btnNo.Visible = false;
				question.btnSi.Visible = false;
				question.ShowDialog();
				Application.Exit();
				return;
			}
			catch (Exception)
			{
				return;
			}
		}
		if (!existeExamen)
		{
			return;
		}
		if (!string.IsNullOrEmpty(evaluaasi.Version))
		{
			lblVersion.Text = $"Versión {Application.ProductVersion} - {evaluaasi.Version}";
		}
		if (e.Error != null)
		{
			MessageBox.Show(e.Error.Message);
			return;
		}
		try
		{
			try
			{
				lblModalidad.Text = "Se han cargado todos los componentes correctamente.";
			}
			catch (Exception ex2)
			{
				ex2.Message.Bitacora("000004", "Inicio", "Error ", "000266", "000008");
				question.lblTitulo.Text = "Evaluaasi - Error";
				question.lblDetalle.Text = ex2.Message;
				question.btnSi.Visible = false;
				question.btnNo.Visible = false;
				question.ShowDialog();
			}
			lblCantidadPreguntas.Text = evaluaasi.NoPreguntas.ToString();
			evaluaasi.Minutos = 60;
			lblTiempoEvaluacion.Text = evaluaasi.Minutos + " minutos";
			if (iniciarSesion)
			{
				CargaImagenes();
				IniciaSesion();
			}
		}
		catch (Exception)
		{
		}
	}

	private bool Conexion()
	{
		Uri requestUri = new Uri("http://xmn.evaluaasi.com/Usuario.asmx");
		try
		{
			WebRequest webRequest = WebRequest.Create(requestUri);
			webRequest.Timeout = 5000;
			webRequest.GetResponse().Close();
			return true;
		}
		catch (Exception)
		{
			label1.Text = "No hay conexion a internet";
			return false;
		}
	}

	public static string GetMACAddress()
	{
		try
		{
			ManagementObjectCollection instances = new ManagementClass("Win32_NetworkAdapterConfiguration").GetInstances();
			string text = string.Empty;
			foreach (ManagementObject item in instances)
			{
				if (text == string.Empty && (bool)item["IPEnabled"])
				{
					text = item["MacAddress"].ToString();
				}
				item.Dispose();
			}
			return text.Replace(":", "");
		}
		catch (Exception ex)
		{
			throw new Exception(ex.Message);
		}
	}

	public static void SetDoubleBuffered(Control c)
	{
		if (!SystemInformation.TerminalServerSession)
		{
			typeof(Control).GetProperty("DoubleBuffered", BindingFlags.Instance | BindingFlags.NonPublic).SetValue(c, true, null);
		}
	}

	public DateTime GetFecha()
	{
		DateTime result = DateTime.Now;
		if (new Helper().Conexion())
		{
			using UsuarioSoapClient usuarioSoapClient = new UsuarioSoapClient();
			result = DateTime.FromOADate(usuarioSoapClient.Fecha());
		}
		return result;
	}

	private bool ValidaVersion()
	{
		bool result = true;
		if (new Helper().Conexion())
		{
			using (MotorUniversalSoapClient motorUniversalSoapClient = new MotorUniversalSoapClient())
			{
				versionExe = motorUniversalSoapClient.VersionAplicacion(2, produccion: true);
				appValida = versionExe.ComparaVersionApp(Application.ProductVersion);
			}
			int num = 1;
			if (!appValida)
			{
				while (true)
				{
					if (num < 4)
					{
						if (DescargaExamenApps(versionExe))
						{
							MessageBox.Show($"La aplicación se actualizará a la versión {versionExe}. Si la aplicación no se ejecuta automáticamente, por favor ejecute el archivo ExamenV{versionExe}.exe", "", MessageBoxButtons.OK, MessageBoxIcon.Asterisk);
							Helper.UnZip(versionExe, appPath);
							using (StreamWriter streamWriter = File.AppendText("Remove.txt"))
							{
								streamWriter.WriteLine(Application.ProductVersion);
							}
							try
							{
								File.SetAttributes(Path.Combine(appPath, "Remove.txt"), FileAttributes.Hidden);
								File.SetAttributes(Path.Combine(appPath, $"ExamenV{Application.ProductVersion}.exe"), FileAttributes.Hidden);
							}
							catch (Exception)
							{
							}
							break;
						}
						num++;
						continue;
					}
					MessageBox.Show("Se encuentra disponible una nueva versión, pero no fue posible realizar la descarga. Por favor verifique su conexión a internet o descargue manualmente la nueva versión", "", MessageBoxButtons.OK, MessageBoxIcon.Hand);
					break;
				}
				result = false;
			}
		}
		else
		{
			versionExe = Application.ProductVersion;
		}
		return result;
	}

	private void CargaExamen()
	{
		List<Licencia> licencias = new List<Licencia>();
		if (new Helper().Conexion())
		{
			using MotorUniversalSoapClient motorUniversalSoapClient = new MotorUniversalSoapClient();
			licencias = motorUniversalSoapClient.Licencias(partner: true).ToList();
		}
		else
		{
			licencias = new List<Licencia>();
			licencias.Add(new Licencia
			{
				Id = 20,
				NombreLicencia = "ECM0121.dat",
				NombreArchivo = "20.xae",
				Letra = "J",
				Nombre = "Cultura Digital"
			});
			licencias.Add(new Licencia
			{
				Id = 21,
				NombreLicencia = "ECM0120.dat",
				NombreArchivo = "21.xae",
				Letra = "K",
				Nombre = "Aprendiendo a Programar Apps"
			});
		}
		DirectoryInfo directoryInfo = new DirectoryInfo(appPath);
		FileInfo[] archivos = (from q in directoryInfo.GetFiles()
			where q.Extension.Equals(".xae") && licencias.Select((Licencia x) => x.NombreArchivo).Contains(q.Name)
			select q).ToArray();
		int num = 0;
		if (archivos.Length != 0)
		{
			if (archivos.Length == 1)
			{
				Licencia licencia = licencias.Where((Licencia q) => q.NombreArchivo.Equals(archivos[0].Name)).FirstOrDefault();
				DatosEvaluacion.IdAplicacion = licencia.Id.ToString();
				DatosEvaluacion.Nombre = licencia.Nombre;
				DatosEvaluacion.Letra = licencia.Letra;
				DatosEvaluacion.Examen = licencia.NombreArchivo;
				DatosEvaluacion.Licencia = licencia.NombreLicencia;
			}
			else
			{
				DatosEvaluacion.Opciones = new string[archivos.Length, 5];
				FileInfo[] array = archivos;
				foreach (FileInfo a in array)
				{
					Licencia licencia2 = licencias.Where((Licencia q) => q.NombreArchivo.Equals(a.Name)).FirstOrDefault();
					if (licencia2 != null)
					{
						DatosEvaluacion.Opciones[num, 0] = licencia2.Nombre;
						DatosEvaluacion.Opciones[num, 1] = licencia2.NombreArchivo;
						DatosEvaluacion.Opciones[num, 2] = licencia2.NombreLicencia;
						DatosEvaluacion.Opciones[num, 3] = licencia2.Id.ToString();
						DatosEvaluacion.Opciones[num, 4] = licencia2.Letra;
						num++;
					}
				}
				new Seleccionar("Parece que se cuenta con más de un archivo de preguntas", "seleccione el examen que desea realizar").ShowDialog();
			}
			if (!string.IsNullOrEmpty(DatosEvaluacion.Examen) || DatosEvaluacion.Examen != "")
			{
				existeExamen = ProcesaArchivo();
				return;
			}
			MessageBox.Show("No cuenta con el archivo de preguntas, por favor solicítelo con su administrador y colóquelo en la misma ruta del ejecutable.\nLa aplicación se cerrará", "", MessageBoxButtons.OK, MessageBoxIcon.Hand);
			Application.Exit();
			return;
		}
		archivos = (from q in directoryInfo.GetFiles()
			where q.Extension.Equals(".xae")
			select q).ToArray();
		if (archivos.Length != 0)
		{
			string empty = string.Empty;
			empty = ((archivos.Length == 1) ? $"El archivo de preguntas {archivos[0].Name} no concuerda" : "Los archivos de preguntas no concuerdan");
			if (!new Helper().Conexion())
			{
				MessageBox.Show($"[ERROR x801-VNA] {empty} con los que se tienen registrados. Por favor verifique que cuenta con un archivo de preguntas válido. Si trabaja fuera de línea tal vez necesite actualizar la versión del examen\nLa aplicación se cerrará", "", MessageBoxButtons.OK, MessageBoxIcon.Hand);
			}
			else
			{
				MessageBox.Show($"[ERROR x802-ANV] {empty} con los que se tienen registrados. Por favor verifique que cuenta con un archivo de preguntas válido\nLa aplicación se cerrará", "", MessageBoxButtons.OK, MessageBoxIcon.Hand);
			}
			Application.Exit();
		}
		else
		{
			existeExamen = false;
			MessageBox.Show("Parece que no cuenta con un archivo de preguntas. Por favor inicie sesión y posteriormente se realizará la descarga", "", MessageBoxButtons.OK, MessageBoxIcon.Asterisk);
		}
	}

	private void CargaImagenes()
	{
		try
		{
			try
			{
				if (!Directory.Exists("Recursos"))
				{
					Directory.CreateDirectory("Recursos");
				}
				new DirectoryInfo(Path.Combine(appPath, "Recursos")).Attributes = FileAttributes.Hidden | FileAttributes.Directory;
			}
			catch (Exception)
			{
			}
			if (!Directory.Exists($"Recursos/{DatosEvaluacion.IdAplicacion}"))
			{
				Directory.CreateDirectory($"Recursos/{DatosEvaluacion.IdAplicacion}");
			}
			new DirectoryInfo(Path.Combine(appPath, "Recursos")).Attributes = FileAttributes.Hidden | FileAttributes.Directory;
			if (new Helper().Conexion())
			{
				cubiertaLbl.Visible = false;
				using (WebClient webClient = new WebClient())
				{
					if (!File.Exists(Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/fondo.png")))
					{
						try
						{
							webClient.DownloadFile(string.Format("{0}{1}/fondo.png", "https://acemsstorage.blob.core.windows.net/conocer/", DatosEvaluacion.IdAplicacion), Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/fondo.png"));
						}
						catch (Exception)
						{
						}
						try
						{
							File.SetAttributes(Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/fondo.png"), FileAttributes.Hidden);
						}
						catch (Exception)
						{
						}
					}
					if (!File.Exists(Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/login.png")))
					{
						try
						{
							webClient.DownloadFile(string.Format("{0}{1}/login.png", "https://acemsstorage.blob.core.windows.net/conocer/", DatosEvaluacion.IdAplicacion), Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/login.png"));
						}
						catch (Exception)
						{
						}
						try
						{
							File.SetAttributes(Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/login.png"), FileAttributes.Hidden);
						}
						catch (Exception)
						{
						}
					}
					if (!File.Exists(Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/fondo_preguntas.png")))
					{
						try
						{
							webClient.DownloadFile(string.Format("{0}{1}/fondo_preguntas.png", "https://acemsstorage.blob.core.windows.net/conocer/", DatosEvaluacion.IdAplicacion), Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/fondo_preguntas.png"));
						}
						catch (Exception)
						{
						}
						try
						{
							File.SetAttributes(Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/fondo_preguntas.png"), FileAttributes.Hidden);
						}
						catch (Exception)
						{
						}
					}
					if (!File.Exists(Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/pleca_superior.png")))
					{
						try
						{
							webClient.DownloadFile(string.Format("{0}{1}/pleca_superior.png", "https://acemsstorage.blob.core.windows.net/conocer/", DatosEvaluacion.IdAplicacion), Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/pleca_superior.png"));
						}
						catch (Exception)
						{
						}
						try
						{
							File.SetAttributes(Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/pleca_superior.png"), FileAttributes.Hidden);
						}
						catch (Exception)
						{
						}
					}
					if (!File.Exists(Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/titulo_examen.png")))
					{
						try
						{
							webClient.DownloadFile(string.Format("{0}{1}/titulo_examen.png", "https://acemsstorage.blob.core.windows.net/conocer/", DatosEvaluacion.IdAplicacion), Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/titulo_examen.png"));
						}
						catch (Exception)
						{
						}
						try
						{
							File.SetAttributes(Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/titulo_examen.png"), FileAttributes.Hidden);
						}
						catch (Exception)
						{
						}
					}
					if (!File.Exists(Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/indicaciones_examen.png")))
					{
						try
						{
							webClient.DownloadFile(string.Format("{0}{1}/indicaciones_examen.png", "https://acemsstorage.blob.core.windows.net/conocer/", DatosEvaluacion.IdAplicacion), Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/indicaciones_examen.png"));
						}
						catch (Exception)
						{
						}
						try
						{
							File.SetAttributes(Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/indicaciones_examen.png"), FileAttributes.Hidden);
						}
						catch (Exception)
						{
						}
					}
				}
				BackgroundImage = Image.FromFile(Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/fondo.png"));
				LoginPictureBox.BackgroundImage = Image.FromFile(Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/login.png"));
			}
			else
			{
				if (File.Exists(Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/fondo.png")))
				{
					cubiertaLbl.Visible = false;
					BackgroundImage = Image.FromFile(Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/fondo.png"));
				}
				if (File.Exists(Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/login.png")))
				{
					LoginPictureBox.BackgroundImage = Image.FromFile(Path.Combine(appPath, $"Recursos/{DatosEvaluacion.IdAplicacion}/login.png"));
				}
			}
		}
		catch (Exception)
		{
		}
	}

	private string ObtieneNombres(string archivo)
	{
		try
		{
			using StreamReader streamReader = new StreamReader(archivo);
			Encripcion encripcion = new Encripcion(13, streamReader.ReadToEnd());
			streamReader.Dispose();
			streamReader.Close();
			MemoryStream stream = new MemoryStream(Encoding.UTF8.GetBytes(encripcion.TextoNormal2));
			return (new XmlSerializer(typeof(Evaluacion), "Evaluacion").Deserialize(stream) as Evaluacion).Nombre;
		}
		catch (Exception)
		{
			return string.Empty;
		}
	}

	private bool ProcesaArchivo()
	{
		bool result = false;
		try
		{
			StreamReader streamReader = new StreamReader(DatosEvaluacion.Examen);
			Encripcion encripcion = new Encripcion(13, streamReader.ReadToEnd());
			streamReader.Dispose();
			streamReader.Close();
			MemoryStream stream = new MemoryStream(Encoding.UTF8.GetBytes(encripcion.TextoNormal2));
			XmlSerializer xmlSerializer = new XmlSerializer(typeof(Evaluacion), "Evaluacion");
			evaluaasi = xmlSerializer.Deserialize(stream) as Evaluacion;
			if (DatosEvaluacion.IdAplicacion.Equals(evaluaasi.EvaluacionId.ToString()))
			{
				evaluaasi.Minutos = 60;
				result = true;
			}
			else
			{
				MessageBox.Show("El nombre del archivo de preguntas no coincide con el contenido.\nLa aplicación se cerrará", "", MessageBoxButtons.OK, MessageBoxIcon.Hand);
				Application.Exit();
			}
			result = true;
		}
		catch (Exception)
		{
			MessageBox.Show("Parece que el archivo de preguntas no es el correcto o está dañado.\nLa aplicación se cerrará", "", MessageBoxButtons.OK, MessageBoxIcon.Hand);
			Application.Exit();
		}
		return result;
	}

	private bool DescargaExamen(int AplicacionId)
	{
		bool result = false;
		try
		{
			if (new Helper().Conexion())
			{
				using MotorUniversalSoapClient motorUniversalSoapClient = new MotorUniversalSoapClient();
				string contents = motorUniversalSoapClient.DescargarExamen(AplicacionId).Rows[0][1].ToString();
				File.WriteAllText(AplicacionId + ".xae", contents);
				result = true;
			}
		}
		catch (Exception)
		{
		}
		return result;
	}

	public bool DescargaExamenApps(string versionApp)
	{
		try
		{
			if (new Helper().Conexion())
			{
				using (WebClient webClient = new WebClient())
				{
					webClient.DownloadFile("https://acemsstorage.blob.core.windows.net/conocer/MotorUniversal/Examen/ExamenV" + versionApp + "_HASH.zip", $"ExamenV{versionApp}.zip");
				}
				return true;
			}
			return false;
		}
		catch (Exception)
		{
			return false;
		}
	}

	public void IniciaSesion()
	{
		DataTable dataTable = new DataTable();
		"Petición a servicio                                       ".Bitacora("000003", "Inicio", "WSAE  ", "000145", "000003");
		using (UsuarioSoapClient usuarioSoapClient = new UsuarioSoapClient())
		{
			dataTable = usuarioSoapClient.LoginV2(userName, password, (int.Parse(DatosEvaluacion.IdAplicacion) != 0) ? int.Parse(DatosEvaluacion.IdAplicacion) : 0, "2000", Application.ProductVersion);
			"Respuesta de servicio                                     ".Bitacora("000003", "Inicio", "WSAE  ", "000147", "000004");
		}
		if (dataTable.Rows.Count > 0)
		{
			DataRow dataRow = dataTable.Rows[0];
			usuario = new Usuario(dataRow);
			voucher = usuario.Acreditaciones.First();
			new Aplicacion(dataRow, Application.ProductVersion);
			URLAviso = dataRow[21].ToString();
			detalleExamen = dataRow[9].ToString();
			bLogin = bool.Parse(dataRow[8].ToString());
			if (bLogin)
			{
				if (voucher.AplicacionId > 0)
				{
					try
					{
						lblCantidadPreguntas.Text = evaluaasi.Preguntas.Count.ToString();
						evaluaasi.Minutos = 60;
						lblTiempoEvaluacion.Text = evaluaasi.Minutos + " minutos";
						lblNombreCompleto.Text = usuario.Nombre + " " + usuario.Apellido;
						PnlBienvenido.Visible = true;
						PnlBienvenido.Dock = DockStyle.Fill;
						PnlBienvenido.BringToFront();
						return;
					}
					catch (Exception ex)
					{
						Question question = new Question();
						ex.Message.Bitacora("000004", "Inicio", "Error ", "000266", "000008");
						question.lblTitulo.Text = "Evaluaasi - Error";
						question.lblDetalle.Text = ex.Message;
						question.btnSi.Visible = false;
						question.btnNo.Visible = false;
						question.ShowDialog();
						return;
					}
				}
				Question question2 = new Question();
				"No tiene vouchers                                         ".Bitacora("000004", "Inicio", "Error ", "000271", "000006");
				question2.lblTitulo.Text = "Evaluaasi";
				question2.lblDetalle.Text = "No cuenta con un voucher para esta aplicación, por favor verifique en plataforma su asignación";
				question2.btnSi.Visible = false;
				question2.btnNo.Visible = false;
				question2.ShowDialog();
			}
			else
			{
				Question question3 = new Question();
				$"{detalleExamen}                 ".Bitacora("000005", "Inicio", "Error ", "000277", "000007");
				question3.lblTitulo.Text = "Evaluaasi";
				question3.lblDetalle.Text = detalleExamen;
				question3.btnSi.Visible = false;
				question3.btnNo.Visible = false;
				question3.ShowDialog();
			}
		}
		else
		{
			Question question4 = new Question();
			"Ocurrió un error al validar el usuario                 ".Bitacora("000005", "Inicio", "Error ", "000277", "000007");
			question4.lblTitulo.Text = "Evaluaasi";
			question4.lblDetalle.Text = "Ocurrió un error al validar el usuario";
			question4.btnSi.Visible = false;
			question4.btnNo.Visible = false;
			question4.ShowDialog();
		}
	}

	private int ObtieneEscenarioAnterior()
	{
		int result = 0;
		try
		{
			if (File.Exists(Path.Combine(appPath, "data.txt")))
			{
				using StreamReader streamReader = new StreamReader("data.txt");
				result = int.Parse(streamReader.ReadToEnd().Trim());
			}
		}
		catch (Exception)
		{
		}
		return result;
	}

	private int ValidarEscenario(int[] escenarios, int ant, int escenario)
	{
		while (ant == escenario)
		{
			int num = new Random().Next(0, escenarios.Length);
			escenario = escenarios[num];
		}
		return escenario;
	}

	private void GuardarEscenario(int escenario)
	{
		try
		{
			string path = Path.Combine(appPath, "data.txt");
			if (!File.Exists(path))
			{
				using StreamWriter streamWriter = File.AppendText(path);
				streamWriter.WriteLine(escenario);
			}
			else
			{
				using FileStream stream = new FileStream(path, FileMode.Truncate);
				using StreamWriter streamWriter2 = new StreamWriter(stream);
				streamWriter2.Write(escenario);
			}
			File.SetAttributes(path, FileAttributes.Hidden);
		}
		catch (Exception)
		{
		}
	}

	private bool ValidaExistencia(string aplicacion)
	{
		bool result = false;
		foreach (FileInfo item in (from q in new DirectoryInfo(appPath).GetFiles()
			where q.Extension.Equals(".xae")
			select q).ToList())
		{
			if (item.Name == $"{aplicacion}.xae")
			{
				result = true;
				break;
			}
		}
		return result;
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
		System.ComponentModel.ComponentResourceManager resources = new System.ComponentModel.ComponentResourceManager(typeof(CulturaDigital.Forms.CulturaDigital_Inicio));
		this.pnlTitle = new System.Windows.Forms.Panel();
		this.lblVersion = new System.Windows.Forms.Label();
		this.btnClose = new System.Windows.Forms.Button();
		this.pbtitulo = new System.Windows.Forms.PictureBox();
		this.pnlContenedorPaneles = new System.Windows.Forms.Panel();
		this.pnlLogin = new System.Windows.Forms.Panel();
		this.lblModalidad = new System.Windows.Forms.Label();
		this.pblogin1 = new System.Windows.Forms.PictureBox();
		this.pnlimagencelular = new System.Windows.Forms.Panel();
		this.cubiertaLbl = new System.Windows.Forms.Label();
		this.btnLogin = new System.Windows.Forms.Button();
		this.txtContrasenia = new System.Windows.Forms.TextBox();
		this.txtUsuario = new System.Windows.Forms.TextBox();
		this.LoginPictureBox = new System.Windows.Forms.PictureBox();
		this.pbSpinner = new System.Windows.Forms.PictureBox();
		this.label1 = new System.Windows.Forms.Label();
		this.PnlBienvenido = new System.Windows.Forms.Panel();
		this.lblTiempoEvaluacion = new System.Windows.Forms.Label();
		this.label3 = new System.Windows.Forms.Label();
		this.label14 = new System.Windows.Forms.Label();
		this.pictureBox2 = new System.Windows.Forms.PictureBox();
		this.lblNombreTipoAplicacion = new System.Windows.Forms.Label();
		this.label8 = new System.Windows.Forms.Label();
		this.label10 = new System.Windows.Forms.Label();
		this.btnRegresarBienvenido = new System.Windows.Forms.Button();
		this.btnContinuarBienvenido = new System.Windows.Forms.Button();
		this.label7 = new System.Windows.Forms.Label();
		this.label15 = new System.Windows.Forms.Label();
		this.label9 = new System.Windows.Forms.Label();
		this.lblCantidadPreguntas = new System.Windows.Forms.Label();
		this.lblTipoAplicacion = new System.Windows.Forms.Label();
		this.lblNombreCompleto = new System.Windows.Forms.Label();
		this.label4 = new System.Windows.Forms.Label();
		this.label11 = new System.Windows.Forms.Label();
		this.label6 = new System.Windows.Forms.Label();
		this.label5 = new System.Windows.Forms.Label();
		this.label2 = new System.Windows.Forms.Label();
		this.label23 = new System.Windows.Forms.Label();
		this.label12 = new System.Windows.Forms.Label();
		this.PnlInstrucciones = new System.Windows.Forms.Panel();
		this.btnAnterior = new System.Windows.Forms.Button();
		this.btnSiguiente = new System.Windows.Forms.Button();
		this.label30 = new System.Windows.Forms.Label();
		this.pictureBox4 = new System.Windows.Forms.PictureBox();
		this.lblTituloInformacionControles = new System.Windows.Forms.Label();
		this.pnlInfoControlesArrastrar = new System.Windows.Forms.Panel();
		this.label41 = new System.Windows.Forms.Label();
		this.label42 = new System.Windows.Forms.Label();
		this.label51 = new System.Windows.Forms.Label();
		this.label59 = new System.Windows.Forms.Label();
		this.label53 = new System.Windows.Forms.Label();
		this.label63 = new System.Windows.Forms.Label();
		this.label52 = new System.Windows.Forms.Label();
		this.label54 = new System.Windows.Forms.Label();
		this.label56 = new System.Windows.Forms.Label();
		this.label68 = new System.Windows.Forms.Label();
		this.label69 = new System.Windows.Forms.Label();
		this.label70 = new System.Windows.Forms.Label();
		this.pnlInfoControlesReloj = new System.Windows.Forms.Panel();
		this.pnlContenedorTotales = new System.Windows.Forms.Panel();
		this.label40 = new System.Windows.Forms.Label();
		this.label50 = new System.Windows.Forms.Label();
		this.label43 = new System.Windows.Forms.Label();
		this.btnResueltasCount = new System.Windows.Forms.Button();
		this.btnRestantesCount = new System.Windows.Forms.Button();
		this.btnOmitidasCount = new System.Windows.Forms.Button();
		this.pnlContenedorTimmer = new System.Windows.Forms.Panel();
		this.lblMinutos = new System.Windows.Forms.Label();
		this.label44 = new System.Windows.Forms.Label();
		this.label49 = new System.Windows.Forms.Label();
		this.label45 = new System.Windows.Forms.Label();
		this.label46 = new System.Windows.Forms.Label();
		this.label47 = new System.Windows.Forms.Label();
		this.label48 = new System.Windows.Forms.Label();
		this.pnlInfoControlesButtons = new System.Windows.Forms.Panel();
		this.label32 = new System.Windows.Forms.Label();
		this.btnOmitir = new System.Windows.Forms.Button();
		this.btnReiniciar = new System.Windows.Forms.Button();
		this.btnFinalizar = new System.Windows.Forms.Button();
		this.label55 = new System.Windows.Forms.Label();
		this.pictureBox5 = new System.Windows.Forms.PictureBox();
		this.label39 = new System.Windows.Forms.Label();
		this.label36 = new System.Windows.Forms.Label();
		this.label33 = new System.Windows.Forms.Label();
		this.label57 = new System.Windows.Forms.Label();
		this.label38 = new System.Windows.Forms.Label();
		this.label35 = new System.Windows.Forms.Label();
		this.label37 = new System.Windows.Forms.Label();
		this.label34 = new System.Windows.Forms.Label();
		this.label31 = new System.Windows.Forms.Label();
		this.pnlImportante = new System.Windows.Forms.Panel();
		this.label60 = new System.Windows.Forms.Label();
		this.pictureBox9 = new System.Windows.Forms.PictureBox();
		this.pictureBox8 = new System.Windows.Forms.PictureBox();
		this.pictureBox7 = new System.Windows.Forms.PictureBox();
		this.label67 = new System.Windows.Forms.Label();
		this.label64 = new System.Windows.Forms.Label();
		this.label62 = new System.Windows.Forms.Label();
		this.label29 = new System.Windows.Forms.Label();
		this.label61 = new System.Windows.Forms.Label();
		this.label65 = new System.Windows.Forms.Label();
		this.pnlInfoReview = new System.Windows.Forms.Panel();
		this.btnAceptarAviso = new System.Windows.Forms.Button();
		this.label28 = new System.Windows.Forms.Label();
		this.label27 = new System.Windows.Forms.Label();
		this.cbAvisoPrivacidad = new System.Windows.Forms.CheckBox();
		this.btnNo = new System.Windows.Forms.Button();
		this.btnSi = new System.Windows.Forms.Button();
		this.pictureBox3 = new System.Windows.Forms.PictureBox();
		this.label22 = new System.Windows.Forms.Label();
		this.label20 = new System.Windows.Forms.Label();
		this.label25 = new System.Windows.Forms.Label();
		this.label24 = new System.Windows.Forms.Label();
		this.label21 = new System.Windows.Forms.Label();
		this.label18 = new System.Windows.Forms.Label();
		this.label19 = new System.Windows.Forms.Label();
		this.label16 = new System.Windows.Forms.Label();
		this.lblCURPUsuario = new System.Windows.Forms.Label();
		this.lblCorreoUsuario = new System.Windows.Forms.Label();
		this.lblNombreUsuario = new System.Windows.Forms.Label();
		this.lblPerfilUsuario = new System.Windows.Forms.Label();
		this.lblModalidadUsuario = new System.Windows.Forms.Label();
		this.lblFecha = new System.Windows.Forms.Label();
		this.lblOportunidadNo = new System.Windows.Forms.Label();
		this.label17 = new System.Windows.Forms.Label();
		this.label13 = new System.Windows.Forms.Label();
		this.label26 = new System.Windows.Forms.Label();
		this.bgwLoad = new System.ComponentModel.BackgroundWorker();
		this.bgwLoadQuestions = new System.ComponentModel.BackgroundWorker();
		this.pnlTitle.SuspendLayout();
		((System.ComponentModel.ISupportInitialize)this.pbtitulo).BeginInit();
		this.pnlContenedorPaneles.SuspendLayout();
		this.pnlLogin.SuspendLayout();
		((System.ComponentModel.ISupportInitialize)this.pblogin1).BeginInit();
		this.pnlimagencelular.SuspendLayout();
		((System.ComponentModel.ISupportInitialize)this.LoginPictureBox).BeginInit();
		((System.ComponentModel.ISupportInitialize)this.pbSpinner).BeginInit();
		this.PnlBienvenido.SuspendLayout();
		((System.ComponentModel.ISupportInitialize)this.pictureBox2).BeginInit();
		this.PnlInstrucciones.SuspendLayout();
		((System.ComponentModel.ISupportInitialize)this.pictureBox4).BeginInit();
		this.pnlInfoControlesArrastrar.SuspendLayout();
		this.pnlInfoControlesReloj.SuspendLayout();
		this.pnlContenedorTotales.SuspendLayout();
		this.pnlContenedorTimmer.SuspendLayout();
		this.pnlInfoControlesButtons.SuspendLayout();
		((System.ComponentModel.ISupportInitialize)this.pictureBox5).BeginInit();
		this.pnlImportante.SuspendLayout();
		((System.ComponentModel.ISupportInitialize)this.pictureBox9).BeginInit();
		((System.ComponentModel.ISupportInitialize)this.pictureBox8).BeginInit();
		((System.ComponentModel.ISupportInitialize)this.pictureBox7).BeginInit();
		this.pnlInfoReview.SuspendLayout();
		((System.ComponentModel.ISupportInitialize)this.pictureBox3).BeginInit();
		base.SuspendLayout();
		this.pnlTitle.BackColor = System.Drawing.Color.Transparent;
		this.pnlTitle.Controls.Add(this.lblVersion);
		this.pnlTitle.Controls.Add(this.btnClose);
		this.pnlTitle.Controls.Add(this.pbtitulo);
		this.pnlTitle.Dock = System.Windows.Forms.DockStyle.Top;
		this.pnlTitle.Location = new System.Drawing.Point(0, 0);
		this.pnlTitle.Name = "pnlTitle";
		this.pnlTitle.Size = new System.Drawing.Size(784, 70);
		this.pnlTitle.TabIndex = 5;
		this.lblVersion.Anchor = System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Left;
		this.lblVersion.AutoSize = true;
		this.lblVersion.Font = new System.Drawing.Font("Segoe UI", 12f, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, 0);
		this.lblVersion.ForeColor = System.Drawing.Color.White;
		this.lblVersion.Location = new System.Drawing.Point(3, 42);
		this.lblVersion.Name = "lblVersion";
		this.lblVersion.Size = new System.Drawing.Size(111, 21);
		this.lblVersion.TabIndex = 17;
		this.lblVersion.Text = "Versión 1.0.0.0";
		this.btnClose.Anchor = System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Right;
		this.btnClose.BackColor = System.Drawing.Color.FromArgb(217, 0, 0);
		this.btnClose.BackgroundImage = CulturaDigital.Properties.Resources.btn_cerrar_reposo;
		this.btnClose.BackgroundImageLayout = System.Windows.Forms.ImageLayout.Stretch;
		this.btnClose.FlatAppearance.BorderSize = 0;
		this.btnClose.FlatAppearance.CheckedBackColor = System.Drawing.Color.FromArgb(227, 22, 51);
		this.btnClose.FlatAppearance.MouseDownBackColor = System.Drawing.Color.FromArgb(165, 0, 0);
		this.btnClose.FlatStyle = System.Windows.Forms.FlatStyle.Flat;
		this.btnClose.Location = new System.Drawing.Point(735, -1);
		this.btnClose.Name = "btnClose";
		this.btnClose.Size = new System.Drawing.Size(50, 34);
		this.btnClose.TabIndex = 1;
		this.btnClose.UseVisualStyleBackColor = false;
		this.btnClose.Click += new System.EventHandler(btnClose_Click);
		this.pbtitulo.BackgroundImageLayout = System.Windows.Forms.ImageLayout.Center;
		this.pbtitulo.Location = new System.Drawing.Point(0, 35);
		this.pbtitulo.Name = "pbtitulo";
		this.pbtitulo.Size = new System.Drawing.Size(784, 35);
		this.pbtitulo.TabIndex = 18;
		this.pbtitulo.TabStop = false;
		this.pnlContenedorPaneles.BackColor = System.Drawing.Color.Transparent;
		this.pnlContenedorPaneles.Controls.Add(this.PnlInstrucciones);
		this.pnlContenedorPaneles.Controls.Add(this.pnlInfoReview);
		this.pnlContenedorPaneles.Controls.Add(this.pnlLogin);
		this.pnlContenedorPaneles.Controls.Add(this.PnlBienvenido);
		this.pnlContenedorPaneles.Dock = System.Windows.Forms.DockStyle.Fill;
		this.pnlContenedorPaneles.Location = new System.Drawing.Point(0, 70);
		this.pnlContenedorPaneles.Name = "pnlContenedorPaneles";
		this.pnlContenedorPaneles.Size = new System.Drawing.Size(784, 491);
		this.pnlContenedorPaneles.TabIndex = 6;
		this.pnlLogin.BackColor = System.Drawing.Color.Transparent;
		this.pnlLogin.Controls.Add(this.lblModalidad);
		this.pnlLogin.Controls.Add(this.pblogin1);
		this.pnlLogin.Controls.Add(this.pnlimagencelular);
		this.pnlLogin.Controls.Add(this.label1);
		this.pnlLogin.Dock = System.Windows.Forms.DockStyle.Fill;
		this.pnlLogin.Location = new System.Drawing.Point(0, 0);
		this.pnlLogin.Name = "pnlLogin";
		this.pnlLogin.Size = new System.Drawing.Size(784, 491);
		this.pnlLogin.TabIndex = 1;
		this.lblModalidad.Anchor = System.Windows.Forms.AnchorStyles.Left | System.Windows.Forms.AnchorStyles.Right;
		this.lblModalidad.BackColor = System.Drawing.Color.Transparent;
		this.lblModalidad.Font = new System.Drawing.Font("Segoe UI", 12f, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, 0);
		this.lblModalidad.ForeColor = System.Drawing.Color.White;
		this.lblModalidad.Location = new System.Drawing.Point(112, 294);
		this.lblModalidad.Name = "lblModalidad";
		this.lblModalidad.Size = new System.Drawing.Size(370, 130);
		this.lblModalidad.TabIndex = 15;
		this.lblModalidad.Text = "Cargando componentes";
		this.lblModalidad.TextAlign = System.Drawing.ContentAlignment.TopCenter;
		this.pblogin1.Anchor = System.Windows.Forms.AnchorStyles.Left | System.Windows.Forms.AnchorStyles.Right;
		this.pblogin1.BackgroundImage = CulturaDigital.Properties.Resources.logo_blanco;
		this.pblogin1.BackgroundImageLayout = System.Windows.Forms.ImageLayout.Center;
		this.pblogin1.Location = new System.Drawing.Point(95, 192);
		this.pblogin1.Name = "pblogin1";
		this.pblogin1.Size = new System.Drawing.Size(397, 100);
		this.pblogin1.TabIndex = 14;
		this.pblogin1.TabStop = false;
		this.pnlimagencelular.BackColor = System.Drawing.Color.Transparent;
		this.pnlimagencelular.Controls.Add(this.cubiertaLbl);
		this.pnlimagencelular.Controls.Add(this.btnLogin);
		this.pnlimagencelular.Controls.Add(this.txtContrasenia);
		this.pnlimagencelular.Controls.Add(this.txtUsuario);
		this.pnlimagencelular.Controls.Add(this.LoginPictureBox);
		this.pnlimagencelular.Controls.Add(this.pbSpinner);
		this.pnlimagencelular.Dock = System.Windows.Forms.DockStyle.Right;
		this.pnlimagencelular.Location = new System.Drawing.Point(516, 0);
		this.pnlimagencelular.Name = "pnlimagencelular";
		this.pnlimagencelular.Size = new System.Drawing.Size(268, 491);
		this.pnlimagencelular.TabIndex = 3;
		this.cubiertaLbl.BackColor = System.Drawing.Color.White;
		this.cubiertaLbl.Location = new System.Drawing.Point(43, 83);
		this.cubiertaLbl.Name = "cubiertaLbl";
		this.cubiertaLbl.Size = new System.Drawing.Size(178, 119);
		this.cubiertaLbl.TabIndex = 18;
		this.btnLogin.BackColor = System.Drawing.Color.WhiteSmoke;
		this.btnLogin.Enabled = false;
		this.btnLogin.FlatAppearance.BorderColor = System.Drawing.Color.Gainsboro;
		this.btnLogin.FlatAppearance.BorderSize = 2;
		this.btnLogin.FlatAppearance.MouseDownBackColor = System.Drawing.Color.LightGray;
		this.btnLogin.FlatAppearance.MouseOverBackColor = System.Drawing.Color.Gainsboro;
		this.btnLogin.FlatStyle = System.Windows.Forms.FlatStyle.Flat;
		this.btnLogin.Font = new System.Drawing.Font("Segoe UI", 12f, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, 0);
		this.btnLogin.ForeColor = System.Drawing.Color.Black;
		this.btnLogin.Location = new System.Drawing.Point(34, 358);
		this.btnLogin.Name = "btnLogin";
		this.btnLogin.Size = new System.Drawing.Size(198, 43);
		this.btnLogin.TabIndex = 7;
		this.btnLogin.Text = "Iniciar sesión";
		this.btnLogin.UseVisualStyleBackColor = false;
		this.btnLogin.Click += new System.EventHandler(btnLogin_Click);
		this.txtContrasenia.Anchor = System.Windows.Forms.AnchorStyles.None;
		this.txtContrasenia.BorderStyle = System.Windows.Forms.BorderStyle.None;
		this.txtContrasenia.Font = new System.Drawing.Font("Segoe UI", 12.75f, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, 0);
		this.txtContrasenia.ForeColor = System.Drawing.Color.FromArgb(106, 106, 106);
		this.txtContrasenia.Location = new System.Drawing.Point(57, 300);
		this.txtContrasenia.Name = "txtContrasenia";
		this.txtContrasenia.PasswordChar = '*';
		this.txtContrasenia.Size = new System.Drawing.Size(160, 23);
		this.txtContrasenia.TabIndex = 2;
		this.txtUsuario.Anchor = System.Windows.Forms.AnchorStyles.None;
		this.txtUsuario.BorderStyle = System.Windows.Forms.BorderStyle.None;
		this.txtUsuario.Font = new System.Drawing.Font("Segoe UI", 12.75f, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, 0);
		this.txtUsuario.ForeColor = System.Drawing.Color.FromArgb(106, 106, 106);
		this.txtUsuario.Location = new System.Drawing.Point(56, 233);
		this.txtUsuario.Name = "txtUsuario";
		this.txtUsuario.Size = new System.Drawing.Size(160, 23);
		this.txtUsuario.TabIndex = 1;
		this.txtUsuario.TextChanged += new System.EventHandler(txtUsuario_TextChanged);
		this.LoginPictureBox.BackColor = System.Drawing.Color.Transparent;
		this.LoginPictureBox.BackgroundImage = CulturaDigital.Properties.Resources.celular;
		this.LoginPictureBox.BackgroundImageLayout = System.Windows.Forms.ImageLayout.Zoom;
		this.LoginPictureBox.Dock = System.Windows.Forms.DockStyle.Fill;
		this.LoginPictureBox.Location = new System.Drawing.Point(0, 0);
		this.LoginPictureBox.Name = "LoginPictureBox";
		this.LoginPictureBox.Size = new System.Drawing.Size(268, 491);
		this.LoginPictureBox.TabIndex = 6;
		this.LoginPictureBox.TabStop = false;
		this.pbSpinner.BackColor = System.Drawing.Color.White;
		this.pbSpinner.BackgroundImageLayout = System.Windows.Forms.ImageLayout.Center;
		this.pbSpinner.ImageLocation = "";
		this.pbSpinner.Location = new System.Drawing.Point(29, 213);
		this.pbSpinner.Name = "pbSpinner";
		this.pbSpinner.Size = new System.Drawing.Size(207, 191);
		this.pbSpinner.SizeMode = System.Windows.Forms.PictureBoxSizeMode.CenterImage;
		this.pbSpinner.TabIndex = 17;
		this.pbSpinner.TabStop = false;
		this.pbSpinner.Visible = false;
		this.label1.Anchor = System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Left | System.Windows.Forms.AnchorStyles.Right;
		this.label1.BackColor = System.Drawing.Color.Transparent;
		this.label1.Font = new System.Drawing.Font("Segoe UI", 12f, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, 0);
		this.label1.ForeColor = System.Drawing.Color.White;
		this.label1.Location = new System.Drawing.Point(3, 467);
		this.label1.Name = "label1";
		this.label1.Size = new System.Drawing.Size(778, 21);
		this.label1.TabIndex = 16;
		this.label1.Text = "Copyright Evaluaasi 2017";
		this.label1.TextAlign = System.Drawing.ContentAlignment.MiddleCenter;
		this.PnlBienvenido.BackColor = System.Drawing.Color.Transparent;
		this.PnlBienvenido.Controls.Add(this.lblTiempoEvaluacion);
		this.PnlBienvenido.Controls.Add(this.label3);
		this.PnlBienvenido.Controls.Add(this.label14);
		this.PnlBienvenido.Controls.Add(this.pictureBox2);
		this.PnlBienvenido.Controls.Add(this.lblNombreTipoAplicacion);
		this.PnlBienvenido.Controls.Add(this.label8);
		this.PnlBienvenido.Controls.Add(this.label10);
		this.PnlBienvenido.Controls.Add(this.btnRegresarBienvenido);
		this.PnlBienvenido.Controls.Add(this.btnContinuarBienvenido);
		this.PnlBienvenido.Controls.Add(this.label7);
		this.PnlBienvenido.Controls.Add(this.label15);
		this.PnlBienvenido.Controls.Add(this.label9);
		this.PnlBienvenido.Controls.Add(this.lblCantidadPreguntas);
		this.PnlBienvenido.Controls.Add(this.lblTipoAplicacion);
		this.PnlBienvenido.Controls.Add(this.lblNombreCompleto);
		this.PnlBienvenido.Controls.Add(this.label4);
		this.PnlBienvenido.Controls.Add(this.label11);
		this.PnlBienvenido.Controls.Add(this.label6);
		this.PnlBienvenido.Controls.Add(this.label5);
		this.PnlBienvenido.Controls.Add(this.label2);
		this.PnlBienvenido.Controls.Add(this.label23);
		this.PnlBienvenido.Controls.Add(this.label12);
		this.PnlBienvenido.Dock = System.Windows.Forms.DockStyle.Fill;
		this.PnlBienvenido.Location = new System.Drawing.Point(0, 0);
		this.PnlBienvenido.Name = "PnlBienvenido";
		this.PnlBienvenido.Size = new System.Drawing.Size(784, 491);
		this.PnlBienvenido.TabIndex = 0;
		this.lblTiempoEvaluacion.AutoSize = true;
		this.lblTiempoEvaluacion.Font = new System.Drawing.Font("Segoe UI Black", 12f, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, 0);
		this.lblTiempoEvaluacion.ForeColor = System.Drawing.Color.White;
		this.lblTiempoEvaluacion.Location = new System.Drawing.Point(466, 234);
		this.lblTiempoEvaluacion.Name = "lblTiempoEvaluacion";
		this.lblTiempoEvaluacion.Size = new System.Drawing.Size(99, 21);
		this.lblTiempoEvaluacion.TabIndex = 29;
		this.lblTiempoEvaluacion.Text = "60 minutos";
		this.label3.AutoSize = true;
		this.label3.Font = new System.Drawing.Font("Segoe UI", 12f, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, 0);
		this.label3.ForeColor = System.Drawing.Color.White;
		this.label3.Location = new System.Drawing.Point(218, 234);
		this.label3.Name = "label3";
		this.label3.Size = new System.Drawing.Size(354, 21);
		this.label3.TabIndex = 21;
		this.label3.Text = "ejercicios en un tiempo máximo de                         .";
		this.label14.AutoSize = true;
		this.label14.Font = new System.Drawing.Font("Segoe UI Black", 12f, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, 0);
		this.label14.ForeColor = System.Drawing.Color.White;
		this.label14.Location = new System.Drawing.Point(376, 330);
		this.label14.Name = "label14";
		this.label14.Size = new System.Drawing.Size(84, 21);
		this.label14.TabIndex = 27;
		this.label14.Text = "Siguiente";
		this.pictureBox2.BackgroundImage = CulturaDigital.Properties.Resources.logo_blanco;
		this.pictureBox2.BackgroundImageLayout = System.Windows.Forms.ImageLayout.Zoom;
		this.pictureBox2.Dock = System.Windows.Forms.DockStyle.Top;
		this.pictureBox2.Location = new System.Drawing.Point(0, 0);
		this.pictureBox2.Name = "pictureBox2";
		this.pictureBox2.Size = new System.Drawing.Size(784, 51);
		this.pictureBox2.TabIndex = 32;
		this.pictureBox2.TabStop = false;
		this.lblNombreTipoAplicacion.AutoSize = true;
		this.lblNombreTipoAplicacion.Font = new System.Drawing.Font("Arial", 12f, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, 0);
		this.lblNombreTipoAplicacion.ForeColor = System.Drawing.Color.White;
		this.lblNombreTipoAplicacion.Location = new System.Drawing.Point(175, 332);
		this.lblNombreTipoAplicacion.Name = "lblNombreTipoAplicacion";
		this.lblNombreTipoAplicacion.Size = new System.Drawing.Size(69, 19);
		this.lblNombreTipoAplicacion.TabIndex = 26;
		this.lblNombreTipoAplicacion.Text = "examen";
		this.label8.AutoSize = true;
		this.label8.Font = new System.Drawing.Font("Segoe UI", 12f, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, 0);
		this.label8.ForeColor = System.Drawing.Color.White;
		this.label8.Location = new System.Drawing.Point(55, 330);
		this.label8.Name = "label8";
		this.label8.Size = new System.Drawing.Size(130, 21);
		this.label8.TabIndex = 18;
		this.label8.Text = "Para continuar el ";
		this.label10.AutoSize = true;
		this.label10.Font = new System.Drawing.Font("Segoe UI", 12f, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, 0);
		this.label10.ForeColor = System.Drawing.Color.White;
		this.label10.Location = new System.Drawing.Point(239, 330);
		this.label10.Name = "label10";
		this.label10.Size = new System.Drawing.Size(229, 21);
		this.label10.TabIndex = 19;
		this.label10.Text = "haz clic en el botón                     .";
		this.btnRegresarBienvenido.Anchor = System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Right;
		this.btnRegresarBienvenido.BackColor = System.Drawing.Color.Transparent;
		this.btnRegresarBienvenido.FlatAppearance.BorderColor = System.Drawing.Color.White;
		this.btnRegresarBienvenido.FlatAppearance.BorderSize = 2;
		this.btnRegresarBienvenido.FlatAppearance.MouseDownBackColor = System.Drawing.Color.FromArgb(255, 109, 14);
		this.btnRegresarBienvenido.FlatAppearance.MouseOverBackColor = System.Drawing.Color.FromArgb(254, 185, 20);
		this.btnRegresarBienvenido.FlatStyle = System.Windows.Forms.FlatStyle.Flat;
		this.btnRegresarBienvenido.Font = new System.Drawing.Font("Segoe UI", 13f);
		this.btnRegresarBienvenido.ForeColor = System.Drawing.Color.White;
		this.btnRegresarBienvenido.Location = new System.Drawing.Point(559, 430);
		this.btnRegresarBienvenido.Name = "btnRegresarBienvenido";
		this.btnRegresarBienvenido.Size = new System.Drawing.Size(101, 38);
		this.btnRegresarBienvenido.TabIndex = 12;
		this.btnRegresarBienvenido.Text = "Atrás";
		this.btnRegresarBienvenido.UseVisualStyleBackColor = false;
		this.btnRegresarBienvenido.Click += new System.EventHandler(btnRegresarBienvenido_Click_1);
		this.btnContinuarBienvenido.Anchor = System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Right;
		this.btnContinuarBienvenido.BackColor = System.Drawing.Color.Transparent;
		this.btnContinuarBienvenido.FlatAppearance.BorderColor = System.Drawing.Color.White;
		this.btnContinuarBienvenido.FlatAppearance.BorderSize = 2;
		this.btnContinuarBienvenido.FlatAppearance.MouseDownBackColor = System.Drawing.Color.FromArgb(17, 113, 174);
		this.btnContinuarBienvenido.FlatAppearance.MouseOverBackColor = System.Drawing.Color.FromArgb(21, 163, 239);
		this.btnContinuarBienvenido.FlatStyle = System.Windows.Forms.FlatStyle.Flat;
		this.btnContinuarBienvenido.Font = new System.Drawing.Font("Segoe UI", 13f);
		this.btnContinuarBienvenido.ForeColor = System.Drawing.Color.White;
		this.btnContinuarBienvenido.Location = new System.Drawing.Point(666, 430);
		this.btnContinuarBienvenido.Name = "btnContinuarBienvenido";
		this.btnContinuarBienvenido.Size = new System.Drawing.Size(101, 38);
		this.btnContinuarBienvenido.TabIndex = 13;
		this.btnContinuarBienvenido.Text = "Siguiente";
		this.btnContinuarBienvenido.UseVisualStyleBackColor = false;
		this.btnContinuarBienvenido.Click += new System.EventHandler(btnContinuarBienvenido_Click_1);
		this.label7.AutoSize = true;
		this.label7.Font = new System.Drawing.Font("Segoe UI", 12f, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, 0);
		this.label7.ForeColor = System.Drawing.Color.White;
		this.label7.Location = new System.Drawing.Point(55, 108);
		this.label7.Name = "label7";
		this.label7.Size = new System.Drawing.Size(96, 21);
		this.label7.TabIndex = 14;
		this.label7.Text = "Bienvenid@:";
		this.label15.AutoSize = true;
		this.label15.BackColor = System.Drawing.Color.Transparent;
		this.label15.Font = new System.Drawing.Font("Segoe UI Black", 12f, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, 0);
		this.label15.ForeColor = System.Drawing.Color.White;
		this.label15.Location = new System.Drawing.Point(348, 348);
		this.label15.Name = "label15";
		this.label15.Size = new System.Drawing.Size(53, 21);
		this.label15.TabIndex = 28;
		this.label15.Text = "Atrás";
		this.label9.AutoSize = true;
		this.label9.Font = new System.Drawing.Font("Segoe UI Black", 12f, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, 0);
		this.label9.ForeColor = System.Drawing.Color.White;
		this.label9.Location = new System.Drawing.Point(116, 275);
		this.label9.Name = "label9";
		this.label9.Size = new System.Drawing.Size(110, 21);
		this.label9.TabIndex = 25;
		this.label9.Text = "Certificación";
		this.lblCantidadPreguntas.Font = new System.Drawing.Font("Segoe UI Black", 12f, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, 0);
		this.lblCantidadPreguntas.ForeColor = System.Drawing.Color.White;
		this.lblCantidadPreguntas.Location = new System.Drawing.Point(177, 235);
		this.lblCantidadPreguntas.Name = "lblCantidadPreguntas";
		this.lblCantidadPreguntas.Size = new System.Drawing.Size(45, 19);
		this.lblCantidadPreguntas.TabIndex = 24;
		this.lblCantidadPreguntas.Text = "000";
		this.lblCantidadPreguntas.TextAlign = System.Drawing.ContentAlignment.MiddleCenter;
		this.lblTipoAplicacion.AutoSize = true;
		this.lblTipoAplicacion.Font = new System.Drawing.Font("Segoe UI Black", 12f, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, 0);
		this.lblTipoAplicacion.ForeColor = System.Drawing.Color.White;
		this.lblTipoAplicacion.Location = new System.Drawing.Point(265, 188);
		this.lblTipoAplicacion.Name = "lblTipoAplicacion";
		this.lblTipoAplicacion.Size = new System.Drawing.Size(197, 21);
		this.lblTipoAplicacion.TabIndex = 23;
		this.lblTipoAplicacion.Text = "examen de certificación";
		this.lblNombreCompleto.AutoSize = true;
		this.lblNombreCompleto.Font = new System.Drawing.Font("Arial", 15f, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, 0);
		this.lblNombreCompleto.ForeColor = System.Drawing.Color.White;
		this.lblNombreCompleto.Location = new System.Drawing.Point(55, 148);
		this.lblNombreCompleto.Name = "lblNombreCompleto";
		this.lblNombreCompleto.Size = new System.Drawing.Size(258, 24);
		this.lblNombreCompleto.TabIndex = 30;
		this.lblNombreCompleto.Text = "*******************************";
		this.label4.AutoSize = true;
		this.label4.Font = new System.Drawing.Font("Arial", 12f, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, 0);
		this.label4.ForeColor = System.Drawing.Color.White;
		this.label4.Location = new System.Drawing.Point(458, 190);
		this.label4.Name = "label4";
		this.label4.Size = new System.Drawing.Size(80, 18);
		this.label4.TabIndex = 22;
		this.label4.Text = "Evaluaasi.";
		this.label11.AutoSize = true;
		this.label11.BackColor = System.Drawing.Color.Transparent;
		this.label11.Font = new System.Drawing.Font("Segoe UI", 12f, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, 0);
		this.label11.ForeColor = System.Drawing.Color.White;
		this.label11.Location = new System.Drawing.Point(55, 348);
		this.label11.Name = "label11";
		this.label11.Size = new System.Drawing.Size(354, 21);
		this.label11.TabIndex = 20;
		this.label11.Text = "Si deseas suspenderlo haz clic en el botón             .";
		this.label6.Font = new System.Drawing.Font("Segoe UI", 12f, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, 0);
		this.label6.ForeColor = System.Drawing.Color.White;
		this.label6.Location = new System.Drawing.Point(55, 254);
		this.label6.Name = "label6";
		this.label6.Size = new System.Drawing.Size(626, 55);
		this.label6.TabIndex = 17;
		this.label6.Text = "Al finalizar el examen podrás generar el reporte el cual te indicará si has alcanzado el nivel de                            .";
		this.label5.AutoSize = true;
		this.label5.Font = new System.Drawing.Font("Segoe UI", 12f, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, 0);
		this.label5.ForeColor = System.Drawing.Color.White;
		this.label5.Location = new System.Drawing.Point(55, 234);
		this.label5.Name = "label5";
		this.label5.Size = new System.Drawing.Size(127, 21);
		this.label5.TabIndex = 16;
		this.label5.Text = "Deberás resolver";
		this.label2.AutoSize = true;
		this.label2.Font = new System.Drawing.Font("Segoe UI", 12f, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, 0);
		this.label2.ForeColor = System.Drawing.Color.White;
		this.label2.Location = new System.Drawing.Point(55, 188);
		this.label2.Name = "label2";
		this.label2.Size = new System.Drawing.Size(217, 21);
		this.label2.TabIndex = 15;
		this.label2.Text = "Estás a punto de comenzar un";
		this.label23.Font = new System.Drawing.Font("Segoe UI Black", 12f, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, 0);
		this.label23.ForeColor = System.Drawing.Color.White;
		this.label23.Location = new System.Drawing.Point(3, 385);
		this.label23.Name = "label23";
		this.label23.Size = new System.Drawing.Size(778, 27);
		this.label23.TabIndex = 31;
		this.label23.Text = "¡Éxito!";
		this.label23.TextAlign = System.Drawing.ContentAlignment.MiddleCenter;
		this.label12.Anchor = System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Left | System.Windows.Forms.AnchorStyles.Right;
		this.label12.BackColor = System.Drawing.Color.Transparent;
		this.label12.Font = new System.Drawing.Font("Segoe UI", 12f, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, 0);
		this.label12.ForeColor = System.Drawing.Color.White;
		this.label12.Location = new System.Drawing.Point(0, 468);
		this.label12.Name = "label12";
		this.label12.Size = new System.Drawing.Size(784, 21);
		this.label12.TabIndex = 33;
		this.label12.Text = "Copyright Evaluaasi 2017";
		this.label12.TextAlign = System.Drawing.ContentAlignment.MiddleCenter;
		this.PnlInstrucciones.BackColor = System.Drawing.Color.Transparent;
		this.PnlInstrucciones.Controls.Add(this.btnAnterior);
		this.PnlInstrucciones.Controls.Add(this.btnSiguiente);
		this.PnlInstrucciones.Controls.Add(this.label30);
		this.PnlInstrucciones.Controls.Add(this.pictureBox4);
		this.PnlInstrucciones.Controls.Add(this.lblTituloInformacionControles);
		this.PnlInstrucciones.Controls.Add(this.pnlInfoControlesReloj);
		this.PnlInstrucciones.Controls.Add(this.pnlInfoControlesButtons);
		this.PnlInstrucciones.Controls.Add(this.pnlImportante);
		this.PnlInstrucciones.Controls.Add(this.pnlInfoControlesArrastrar);
		this.PnlInstrucciones.Dock = System.Windows.Forms.DockStyle.Fill;
		this.PnlInstrucciones.Location = new System.Drawing.Point(0, 0);
		this.PnlInstrucciones.Name = "PnlInstrucciones";
		this.PnlInstrucciones.Size = new System.Drawing.Size(784, 491);
		this.PnlInstrucciones.TabIndex = 40;
		this.btnAnterior.Anchor = System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Right;
		this.btnAnterior.BackColor = System.Drawing.Color.Transparent;
		this.btnAnterior.FlatAppearance.BorderColor = System.Drawing.Color.White;
		this.btnAnterior.FlatAppearance.BorderSize = 2;
		this.btnAnterior.FlatAppearance.MouseDownBackColor = System.Drawing.Color.FromArgb(255, 109, 14);
		this.btnAnterior.FlatAppearance.MouseOverBackColor = System.Drawing.Color.FromArgb(254, 185, 20);
		this.btnAnterior.FlatStyle = System.Windows.Forms.FlatStyle.Flat;
		this.btnAnterior.Font = new System.Drawing.Font("Segoe UI", 13f);
		this.btnAnterior.ForeColor = System.Drawing.Color.White;
		this.btnAnterior.Location = new System.Drawing.Point(559, 430);
		this.btnAnterior.Name = "btnAnterior";
		this.btnAnterior.Size = new System.Drawing.Size(101, 38);
		this.btnAnterior.TabIndex = 39;
		this.btnAnterior.Text = "Atrás";
		this.btnAnterior.UseVisualStyleBackColor = false;
		this.btnAnterior.Click += new System.EventHandler(button1_Click);
		this.btnSiguiente.Anchor = System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Right;
		this.btnSiguiente.BackColor = System.Drawing.Color.Transparent;
		this.btnSiguiente.FlatAppearance.BorderColor = System.Drawing.Color.White;
		this.btnSiguiente.FlatAppearance.BorderSize = 2;
		this.btnSiguiente.FlatAppearance.MouseDownBackColor = System.Drawing.Color.FromArgb(17, 113, 174);
		this.btnSiguiente.FlatAppearance.MouseOverBackColor = System.Drawing.Color.FromArgb(21, 163, 239);
		this.btnSiguiente.FlatStyle = System.Windows.Forms.FlatStyle.Flat;
		this.btnSiguiente.Font = new System.Drawing.Font("Segoe UI", 13f);
		this.btnSiguiente.ForeColor = System.Drawing.Color.White;
		this.btnSiguiente.Location = new System.Drawing.Point(666, 430);
		this.btnSiguiente.Name = "btnSiguiente";
		this.btnSiguiente.Size = new System.Drawing.Size(101, 38);
		this.btnSiguiente.TabIndex = 40;
		this.btnSiguiente.Text = "Siguiente";
		this.btnSiguiente.UseVisualStyleBackColor = false;
		this.btnSiguiente.Click += new System.EventHandler(btnSiguiente_Click);
		this.label30.Anchor = System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Left | System.Windows.Forms.AnchorStyles.Right;
		this.label30.BackColor = System.Drawing.Color.Transparent;
		this.label30.Font = new System.Drawing.Font("Segoe UI", 12f, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, 0);
		this.label30.ForeColor = System.Drawing.Color.White;
		this.label30.Location = new System.Drawing.Point(0, 468);
		this.label30.Name = "label30";
		this.label30.Size = new System.Drawing.Size(784, 21);
		this.label30.TabIndex = 38;
		this.label30.Text = "Copyright Evaluaasi 2017";
		this.label30.TextAlign = System.Drawing.ContentAlignment.MiddleCenter;
		this.pictureBox4.BackgroundImage = CulturaDigital.Properties.Resources.logo_blanco;
		this.pictureBox4.BackgroundImageLayout = System.Windows.Forms.ImageLayout.Zoom;
		this.pictureBox4.Dock = System.Windows.Forms.DockStyle.Top;
		this.pictureBox4.Location = new System.Drawing.Point(0, 0);
		this.pictureBox4.Name = "pictureBox4";
		this.pictureBox4.Size = new System.Drawing.Size(784, 51);
		this.pictureBox4.TabIndex = 34;
		this.pictureBox4.TabStop = false;
		this.lblTituloInformacionControles.Font = new System.Drawing.Font("Segoe UI", 12f, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, 0);
		this.lblTituloInformacionControles.ForeColor = System.Drawing.Color.White;
		this.lblTituloInformacionControles.Location = new System.Drawing.Point(0, 102);
		this.lblTituloInformacionControles.Name = "lblTituloInformacionControles";
		this.lblTituloInformacionControles.Size = new System.Drawing.Size(784, 36);
		this.lblTituloInformacionControles.TabIndex = 35;
		this.lblTituloInformacionControles.Text = "Información sobre los controles:";
		this.lblTituloInformacionControles.TextAlign = System.Drawing.ContentAlignment.MiddleCenter;
		this.pnlInfoControlesArrastrar.Controls.Add(this.label41);
		this.pnlInfoControlesArrastrar.Controls.Add(this.label42);
		this.pnlInfoControlesArrastrar.Controls.Add(this.label51);
		this.pnlInfoControlesArrastrar.Controls.Add(this.label59);
		this.pnlInfoControlesArrastrar.Controls.Add(this.label53);
		this.pnlInfoControlesArrastrar.Controls.Add(this.label63);
		this.pnlInfoControlesArrastrar.Controls.Add(this.label52);
		this.pnlInfoControlesArrastrar.Controls.Add(this.label54);
		this.pnlInfoControlesArrastrar.Controls.Add(this.label56);
		this.pnlInfoControlesArrastrar.Controls.Add(this.label68);
		this.pnlInfoControlesArrastrar.Controls.Add(this.label69);
		this.pnlInfoControlesArrastrar.Controls.Add(this.label70);
		this.pnlInfoControlesArrastrar.Location = new System.Drawing.Point(26, 141);
		this.pnlInfoControlesArrastrar.Name = "pnlInfoControlesArrastrar";
		this.pnlInfoControlesArrastrar.Size = new System.Drawing.Size(732, 267);
		this.pnlInfoControlesArrastrar.TabIndex = 44;
		this.label41.Font = new System.Drawing.Font("Segoe UI", 12f, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, 0);
		this.label41.ForeColor = System.Drawing.Color.White;
		this.label41.Location = new System.Drawing.Point(167, 210);
		this.label41.Name = "label41";
		this.label41.Size = new System.Drawing.Size(543, 43);
		this.label41.TabIndex = 35;
		this.label41.Text = "Deberás indicar si la afirmación es verdadera o falsa";
		this.label42.Font = new System.Drawing.Font("Segoe UI", 12f, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, 0);
		this.label42.ForeColor = System.Drawing.Color.White;
		this.label42.Location = new System.Drawing.Point(33, 210);
		this.label42.Name = "label42";
		this.label42.Size = new System.Drawing.Size(141, 21);
		this.label42.TabIndex = 36;
		this.label42.Text = "Verdadero/Falso:";
		this.label51.AutoSize = true;
		this.label51.Font = new System.Drawing.Font("Segoe UI", 12f, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, 0);
		this.label51.ForeColor = System.Drawing.Color.White;
		this.label51.Location = new System.Drawing.Point(168, 131);
		this.label51.Name = "label51";
		this.label51.Size = new System.Drawing.Size(269, 21);
		this.label51.TabIndex = 31;
		this.label51.Text = "Deberás elegir las opciones correctas.";
		this.label59.AutoSize = true;
		this.label59.Font = new System.Drawing.Font("Segoe UI", 12f, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, 0);
		this.label59.ForeColor = System.Drawing.Color.White;
		this.label59.Location = new System.Drawing.Point(168, 96);
		this.label59.Name = "label59";
		this.label59.Size = new System.Drawing.Size(364, 21);
		this.label59.TabIndex = 32;
		this.label59.Text = "Deberás elegir la opción correcta. (solo una opción)";
		this.label53.AutoSize = true;
		this.label53.Font = new System.Drawing.Font("Segoe UI", 12f, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, 0);
		this.label53.ForeColor = System.Drawing.Color.White;
		this.label53.Location = new System.Drawing.Point(16, 131);
		this.label53.Name = "label53";
		this.label53.Size = new System.Drawing.Size(156, 21);
		this.label53.TabIndex = 33;
		this.label53.Text = "Selección múltiple:";
		this.label63.AutoSize = true;
		this.label63.Font = new System.Drawing.Font("Segoe UI", 12f, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, 0);
		this.label63.ForeColor = System.Drawing.Color.White;
		this.label63.Location = new System.Drawing.Point(34, 96);
		this.label63.Name = "label63";
		this.label63.Size = new System.Drawing.Size(138, 21);
		this.label63.TabIndex = 34;
		this.label63.Text = "Opción múltiple:";
		this.label52.Font = new System.Drawing.Font("Segoe UI", 12f, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, 0);
		this.label52.ForeColor = System.Drawing.Color.White;
		this.label52.Location = new System.Drawing.Point(168, 61);
		this.label52.Name = "label52";
		this.label52.Size = new System.Drawing.Size(543, 43);
		this.label52.TabIndex = 25;
		this.label52.Text = "Deberás arrastrar y colocar los elementos de la lista en el orden correcto.";
		this.label54.Font = new System.Drawing.Font("Segoe UI", 12f, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, 0);
		this.label54.ForeColor = System.Drawing.Color.White;
		this.label54.Location = new System.Drawing.Point(167, 164);
		this.label54.Name = "label54";
		this.label54.Size = new System.Drawing.Size(561, 46);
		this.label54.TabIndex = 26;
		this.label54.Text = "Deberás arrastrar las opciones correctas de la columna izquierda y llevarlas a la columna derecha en el orden correcto.";
		this.label56.Font = new System.Drawing.Font("Segoe UI", 12f, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, 0);
		this.label56.ForeColor = System.Drawing.Color.White;
		this.label56.Location = new System.Drawing.Point(3, 165);
		this.label56.Name = "label56";
		this.label56.Size = new System.Drawing.Size(169, 21);
		this.label56.TabIndex = 27;
		this.label56.Text = "Arrastrar y ordenar:";
		this.label56.TextAlign = System.Drawing.ContentAlignment.MiddleRight;
		this.label68.Font = new System.Drawing.Font("Segoe UI", 12f, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, 0);
		this.label68.ForeColor = System.Drawing.Color.White;
		this.label68.Location = new System.Drawing.Point(168, 13);
		this.label68.Name = "label68";
		this.label68.Size = new System.Drawing.Size(561, 46);
		this.label68.TabIndex = 28;
		this.label68.Text = "Deberás arrastrar las opciones correctas de la columna izquierda y llevarlas a la columna derecha.";
		this.label69.Font = new System.Drawing.Font("Segoe UI", 12f, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, 0);
		this.label69.ForeColor = System.Drawing.Color.White;
		this.label69.Location = new System.Drawing.Point(20, 13);
		this.label69.Name = "label69";
		this.label69.Size = new System.Drawing.Size(152, 21);
		this.label69.TabIndex = 29;
		this.label69.Text = "Arrastrar y soltar:";
		this.label69.TextAlign = System.Drawing.ContentAlignment.MiddleRight;
		this.label70.AutoSize = true;
		this.label70.Font = new System.Drawing.Font("Segoe UI", 12f, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, 0);
		this.label70.ForeColor = System.Drawing.Color.White;
		this.label70.Location = new System.Drawing.Point(46, 61);
		this.label70.Name = "label70";
		this.label70.Size = new System.Drawing.Size(125, 21);
		this.label70.TabIndex = 30;
		this.label70.Text = "Ordenamiento:";
		this.pnlInfoControlesReloj.Controls.Add(this.pnlContenedorTotales);
		this.pnlInfoControlesReloj.Controls.Add(this.pnlContenedorTimmer);
		this.pnlInfoControlesReloj.Controls.Add(this.label44);
		this.pnlInfoControlesReloj.Controls.Add(this.label49);
		this.pnlInfoControlesReloj.Controls.Add(this.label45);
		this.pnlInfoControlesReloj.Controls.Add(this.label46);
		this.pnlInfoControlesReloj.Controls.Add(this.label47);
		this.pnlInfoControlesReloj.Controls.Add(this.label48);
		this.pnlInfoControlesReloj.Location = new System.Drawing.Point(26, 141);
		this.pnlInfoControlesReloj.Name = "pnlInfoControlesReloj";
		this.pnlInfoControlesReloj.Size = new System.Drawing.Size(732, 267);
		this.pnlInfoControlesReloj.TabIndex = 41;
		this.pnlContenedorTotales.Anchor = System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Right;
		this.pnlContenedorTotales.BackColor = System.Drawing.Color.White;
		this.pnlContenedorTotales.Controls.Add(this.label40);
		this.pnlContenedorTotales.Controls.Add(this.label50);
		this.pnlContenedorTotales.Controls.Add(this.label43);
		this.pnlContenedorTotales.Controls.Add(this.btnResueltasCount);
		this.pnlContenedorTotales.Controls.Add(this.btnRestantesCount);
		this.pnlContenedorTotales.Controls.Add(this.btnOmitidasCount);
		this.pnlContenedorTotales.Location = new System.Drawing.Point(391, 147);
		this.pnlContenedorTotales.Name = "pnlContenedorTotales";
		this.pnlContenedorTotales.Size = new System.Drawing.Size(203, 88);
		this.pnlContenedorTotales.TabIndex = 41;
		this.label40.Anchor = System.Windows.Forms.AnchorStyles.Right;
		this.label40.AutoSize = true;
		this.label40.BackColor = System.Drawing.Color.Transparent;
		this.label40.Font = new System.Drawing.Font("Segoe UI", 9.75f, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, 0);
		this.label40.ForeColor = System.Drawing.Color.FromArgb(0, 52, 102);
		this.label40.Location = new System.Drawing.Point(135, 66);
		this.label40.Name = "label40";
		this.label40.Size = new System.Drawing.Size(60, 17);
		this.label40.TabIndex = 28;
		this.label40.Text = "Omitidas";
		this.label50.Anchor = System.Windows.Forms.AnchorStyles.Right;
		this.label50.AutoSize = true;
		this.label50.BackColor = System.Drawing.Color.Transparent;
		this.label50.Font = new System.Drawing.Font("Segoe UI", 9.75f, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, 0);
		this.label50.ForeColor = System.Drawing.Color.FromArgb(0, 52, 102);
		this.label50.Location = new System.Drawing.Point(7, 66);
		this.label50.Name = "label50";
		this.label50.Size = new System.Drawing.Size(63, 17);
		this.label50.TabIndex = 29;
		this.label50.Text = "Resueltas";
		this.label50.TextAlign = System.Drawing.ContentAlignment.TopCenter;
		this.label43.Anchor = System.Windows.Forms.AnchorStyles.Right;
		this.label43.AutoSize = true;
		this.label43.BackColor = System.Drawing.Color.Transparent;
		this.label43.Font = new System.Drawing.Font("Segoe UI", 9.75f, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, 0);
		this.label43.ForeColor = System.Drawing.Color.FromArgb(0, 52, 102);
		this.label43.Location = new System.Drawing.Point(70, 66);
		this.label43.Name = "label43";
		this.label43.Size = new System.Drawing.Size(64, 17);
		this.label43.TabIndex = 30;
		this.label43.Text = "Restantes";
		this.btnResueltasCount.Anchor = System.Windows.Forms.AnchorStyles.Right;
		this.btnResueltasCount.BackColor = System.Drawing.Color.FromArgb(21, 187, 249);
		this.btnResueltasCount.BackgroundImageLayout = System.Windows.Forms.ImageLayout.Center;
		this.btnResueltasCount.FlatAppearance.BorderColor = System.Drawing.Color.FromArgb(21, 187, 249);
		this.btnResueltasCount.FlatAppearance.MouseDownBackColor = System.Drawing.Color.FromArgb(21, 187, 249);
		this.btnResueltasCount.FlatAppearance.MouseOverBackColor = System.Drawing.Color.FromArgb(21, 187, 249);
		this.btnResueltasCount.FlatStyle = System.Windows.Forms.FlatStyle.Flat;
		this.btnResueltasCount.Font = new System.Drawing.Font("Segoe UI", 20.25f, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, 0);
		this.btnResueltasCount.ForeColor = System.Drawing.Color.White;
		this.btnResueltasCount.Location = new System.Drawing.Point(8, 6);
		this.btnResueltasCount.Name = "btnResueltasCount";
		this.btnResueltasCount.Size = new System.Drawing.Size(60, 60);
		this.btnResueltasCount.TabIndex = 31;
		this.btnResueltasCount.Text = "10";
		this.btnResueltasCount.UseVisualStyleBackColor = false;
		this.btnRestantesCount.Anchor = System.Windows.Forms.AnchorStyles.Right;
		this.btnRestantesCount.BackColor = System.Drawing.Color.FromArgb(12, 29, 72);
		this.btnRestantesCount.BackgroundImageLayout = System.Windows.Forms.ImageLayout.Center;
		this.btnRestantesCount.FlatAppearance.BorderColor = System.Drawing.Color.FromArgb(12, 29, 72);
		this.btnRestantesCount.FlatAppearance.BorderSize = 2;
		this.btnRestantesCount.FlatAppearance.MouseDownBackColor = System.Drawing.Color.FromArgb(12, 29, 72);
		this.btnRestantesCount.FlatAppearance.MouseOverBackColor = System.Drawing.Color.FromArgb(12, 29, 72);
		this.btnRestantesCount.FlatStyle = System.Windows.Forms.FlatStyle.Flat;
		this.btnRestantesCount.Font = new System.Drawing.Font("Segoe UI", 20.25f, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, 0);
		this.btnRestantesCount.ForeColor = System.Drawing.Color.White;
		this.btnRestantesCount.Location = new System.Drawing.Point(71, 6);
		this.btnRestantesCount.Name = "btnRestantesCount";
		this.btnRestantesCount.Size = new System.Drawing.Size(60, 60);
		this.btnRestantesCount.TabIndex = 32;
		this.btnRestantesCount.Text = "40";
		this.btnRestantesCount.UseVisualStyleBackColor = false;
		this.btnOmitidasCount.Anchor = System.Windows.Forms.AnchorStyles.Right;
		this.btnOmitidasCount.BackColor = System.Drawing.Color.FromArgb(26, 112, 199);
		this.btnOmitidasCount.BackgroundImageLayout = System.Windows.Forms.ImageLayout.Center;
		this.btnOmitidasCount.FlatAppearance.BorderColor = System.Drawing.Color.FromArgb(26, 112, 199);
		this.btnOmitidasCount.FlatAppearance.BorderSize = 2;
		this.btnOmitidasCount.FlatAppearance.MouseDownBackColor = System.Drawing.Color.FromArgb(26, 112, 199);
		this.btnOmitidasCount.FlatAppearance.MouseOverBackColor = System.Drawing.Color.FromArgb(26, 112, 199);
		this.btnOmitidasCount.FlatStyle = System.Windows.Forms.FlatStyle.Flat;
		this.btnOmitidasCount.Font = new System.Drawing.Font("Segoe UI", 20.25f, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, 0);
		this.btnOmitidasCount.ForeColor = System.Drawing.Color.White;
		this.btnOmitidasCount.Location = new System.Drawing.Point(134, 6);
		this.btnOmitidasCount.Name = "btnOmitidasCount";
		this.btnOmitidasCount.Size = new System.Drawing.Size(60, 60);
		this.btnOmitidasCount.TabIndex = 33;
		this.btnOmitidasCount.Text = "10";
		this.btnOmitidasCount.UseVisualStyleBackColor = false;
		this.pnlContenedorTimmer.Anchor = System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Right;
		this.pnlContenedorTimmer.BackColor = System.Drawing.Color.White;
		this.pnlContenedorTimmer.Controls.Add(this.lblMinutos);
		this.pnlContenedorTimmer.Location = new System.Drawing.Point(102, 147);
		this.pnlContenedorTimmer.Name = "pnlContenedorTimmer";
		this.pnlContenedorTimmer.Size = new System.Drawing.Size(122, 87);
		this.pnlContenedorTimmer.TabIndex = 40;
		this.lblMinutos.BackColor = System.Drawing.Color.Transparent;
		this.lblMinutos.Dock = System.Windows.Forms.DockStyle.Fill;
		this.lblMinutos.Font = new System.Drawing.Font("Arial", 30f, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, 0);
		this.lblMinutos.ForeColor = System.Drawing.Color.FromArgb(0, 52, 102);
		this.lblMinutos.Location = new System.Drawing.Point(0, 0);
		this.lblMinutos.Name = "lblMinutos";
		this.lblMinutos.Size = new System.Drawing.Size(122, 87);
		this.lblMinutos.TabIndex = 10;
		this.lblMinutos.Text = "30:50";
		this.lblMinutos.TextAlign = System.Drawing.ContentAlignment.MiddleCenter;
		this.label44.AutoSize = true;
		this.label44.Font = new System.Drawing.Font("Segoe UI", 12f, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, 0);
		this.label44.ForeColor = System.Drawing.Color.White;
		this.label44.Location = new System.Drawing.Point(110, 80);
		this.label44.Name = "label44";
		this.label44.Size = new System.Drawing.Size(563, 21);
		this.label44.TabIndex = 18;
		this.label44.Text = "Muestra información relevante de las preguntas (resueltas, restantes y omitidas)";
		this.label49.AutoSize = true;
		this.label49.Font = new System.Drawing.Font("Segoe UI", 12f, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, 0);
		this.label49.ForeColor = System.Drawing.Color.White;
		this.label49.Location = new System.Drawing.Point(461, 234);
		this.label49.Name = "label49";
		this.label49.Size = new System.Drawing.Size(64, 21);
		this.label49.TabIndex = 18;
		this.label49.Text = "Estatus";
		this.label45.AutoSize = true;
		this.label45.Font = new System.Drawing.Font("Segoe UI", 12f, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, 0);
		this.label45.ForeColor = System.Drawing.Color.White;
		this.label45.Location = new System.Drawing.Point(110, 234);
		this.label45.Name = "label45";
		this.label45.Size = new System.Drawing.Size(102, 21);
		this.label45.TabIndex = 18;
		this.label45.Text = "Cronómetro";
		this.label46.AutoSize = true;
		this.label46.Font = new System.Drawing.Font("Segoe UI", 12f, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, 0);
		this.label46.ForeColor = System.Drawing.Color.White;
		this.label46.Location = new System.Drawing.Point(3, 80);
		this.label46.Name = "label46";
		this.label46.Size = new System.Drawing.Size(68, 21);
		this.label46.TabIndex = 18;
		this.label46.Text = "Estatus:";
		this.label46.TextAlign = System.Drawing.ContentAlignment.MiddleRight;
		this.label47.AutoSize = true;
		this.label47.Font = new System.Drawing.Font("Segoe UI", 12f, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, 0);
		this.label47.ForeColor = System.Drawing.Color.White;
		this.label47.Location = new System.Drawing.Point(110, 24);
		this.label47.Name = "label47";
		this.label47.Size = new System.Drawing.Size(360, 21);
		this.label47.TabIndex = 18;
		this.label47.Text = "Muestra el tiempo transcurrido durante el examen.";
		this.label48.AutoSize = true;
		this.label48.Font = new System.Drawing.Font("Segoe UI", 12f, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, 0);
		this.label48.ForeColor = System.Drawing.Color.White;
		this.label48.Location = new System.Drawing.Point(3, 24);
		this.label48.Name = "label48";
		this.label48.Size = new System.Drawing.Size(106, 21);
		this.label48.TabIndex = 18;
		this.label48.Text = "Cronómetro:";
		this.label48.TextAlign = System.Drawing.ContentAlignment.MiddleRight;
		this.pnlInfoControlesButtons.Controls.Add(this.label32);
		this.pnlInfoControlesButtons.Controls.Add(this.btnOmitir);
		this.pnlInfoControlesButtons.Controls.Add(this.btnReiniciar);
		this.pnlInfoControlesButtons.Controls.Add(this.btnFinalizar);
		this.pnlInfoControlesButtons.Controls.Add(this.label55);
		this.pnlInfoControlesButtons.Controls.Add(this.pictureBox5);
		this.pnlInfoControlesButtons.Controls.Add(this.label39);
		this.pnlInfoControlesButtons.Controls.Add(this.label36);
		this.pnlInfoControlesButtons.Controls.Add(this.label33);
		this.pnlInfoControlesButtons.Controls.Add(this.label57);
		this.pnlInfoControlesButtons.Controls.Add(this.label38);
		this.pnlInfoControlesButtons.Controls.Add(this.label35);
		this.pnlInfoControlesButtons.Controls.Add(this.label37);
		this.pnlInfoControlesButtons.Controls.Add(this.label34);
		this.pnlInfoControlesButtons.Controls.Add(this.label31);
		this.pnlInfoControlesButtons.Location = new System.Drawing.Point(26, 141);
		this.pnlInfoControlesButtons.Name = "pnlInfoControlesButtons";
		this.pnlInfoControlesButtons.Size = new System.Drawing.Size(732, 267);
		this.pnlInfoControlesButtons.TabIndex = 36;
		this.label32.AutoSize = true;
		this.label32.Font = new System.Drawing.Font("Segoe UI", 12f, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, 0);
		this.label32.ForeColor = System.Drawing.Color.White;
		this.label32.Location = new System.Drawing.Point(165, 16);
		this.label32.Name = "label32";
		this.label32.Size = new System.Drawing.Size(328, 21);
		this.label32.TabIndex = 18;
		this.label32.Text = "Evaluará la pregunta y avanzará a la siguiente.";
		this.btnOmitir.Anchor = System.Windows.Forms.AnchorStyles.Right;
		this.btnOmitir.BackColor = System.Drawing.Color.FromArgb(145, 195, 19);
		this.btnOmitir.BackgroundImage = CulturaDigital.Properties.Resources.Timer_Mark;
		this.btnOmitir.BackgroundImageLayout = System.Windows.Forms.ImageLayout.Center;
		this.btnOmitir.FlatAppearance.BorderSize = 0;
		this.btnOmitir.FlatAppearance.MouseDownBackColor = System.Drawing.Color.FromArgb(87, 108, 15);
		this.btnOmitir.FlatAppearance.MouseOverBackColor = System.Drawing.Color.FromArgb(121, 164, 22);
		this.btnOmitir.FlatStyle = System.Windows.Forms.FlatStyle.Flat;
		this.btnOmitir.ForeColor = System.Drawing.Color.White;
		this.btnOmitir.Location = new System.Drawing.Point(7, 140);
		this.btnOmitir.Name = "btnOmitir";
		this.btnOmitir.Size = new System.Drawing.Size(60, 60);
		this.btnOmitir.TabIndex = 31;
		this.btnOmitir.UseVisualStyleBackColor = false;
		this.btnReiniciar.Anchor = System.Windows.Forms.AnchorStyles.Right;
		this.btnReiniciar.BackColor = System.Drawing.Color.FromArgb(254, 185, 20);
		this.btnReiniciar.BackgroundImage = CulturaDigital.Properties.Resources.Reload_Mark;
		this.btnReiniciar.BackgroundImageLayout = System.Windows.Forms.ImageLayout.Center;
		this.btnReiniciar.FlatAppearance.BorderSize = 0;
		this.btnReiniciar.FlatAppearance.MouseDownBackColor = System.Drawing.Color.FromArgb(255, 109, 14);
		this.btnReiniciar.FlatAppearance.MouseOverBackColor = System.Drawing.Color.FromArgb(255, 164, 21);
		this.btnReiniciar.FlatStyle = System.Windows.Forms.FlatStyle.Flat;
		this.btnReiniciar.ForeColor = System.Drawing.Color.White;
		this.btnReiniciar.Location = new System.Drawing.Point(7, 73);
		this.btnReiniciar.Name = "btnReiniciar";
		this.btnReiniciar.Size = new System.Drawing.Size(60, 60);
		this.btnReiniciar.TabIndex = 30;
		this.btnReiniciar.UseVisualStyleBackColor = false;
		this.btnFinalizar.Anchor = System.Windows.Forms.AnchorStyles.Right;
		this.btnFinalizar.BackColor = System.Drawing.Color.FromArgb(15, 163, 239);
		this.btnFinalizar.BackgroundImage = CulturaDigital.Properties.Resources.Check_Mark;
		this.btnFinalizar.BackgroundImageLayout = System.Windows.Forms.ImageLayout.Center;
		this.btnFinalizar.FlatAppearance.BorderSize = 0;
		this.btnFinalizar.FlatAppearance.MouseDownBackColor = System.Drawing.Color.FromArgb(21, 123, 193);
		this.btnFinalizar.FlatAppearance.MouseOverBackColor = System.Drawing.Color.FromArgb(23, 145, 196);
		this.btnFinalizar.FlatStyle = System.Windows.Forms.FlatStyle.Flat;
		this.btnFinalizar.ForeColor = System.Drawing.Color.White;
		this.btnFinalizar.Location = new System.Drawing.Point(7, 7);
		this.btnFinalizar.Name = "btnFinalizar";
		this.btnFinalizar.Size = new System.Drawing.Size(60, 60);
		this.btnFinalizar.TabIndex = 29;
		this.btnFinalizar.UseVisualStyleBackColor = false;
		this.label55.Font = new System.Drawing.Font("Segoe UI", 12f, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, 0);
		this.label55.ForeColor = System.Drawing.Color.White;
		this.label55.Location = new System.Drawing.Point(69, 223);
		this.label55.Name = "label55";
		this.label55.Size = new System.Drawing.Size(90, 21);
		this.label55.TabIndex = 20;
		this.label55.Text = "Ayuda:";
		this.label55.TextAlign = System.Drawing.ContentAlignment.MiddleRight;
		this.pictureBox5.Anchor = System.Windows.Forms.AnchorStyles.Left;
		this.pictureBox5.BackColor = System.Drawing.Color.Transparent;
		this.pictureBox5.BackgroundImage = CulturaDigital.Properties.Resources.Help;
		this.pictureBox5.BackgroundImageLayout = System.Windows.Forms.ImageLayout.Center;
		this.pictureBox5.Location = new System.Drawing.Point(7, 204);
		this.pictureBox5.Name = "pictureBox5";
		this.pictureBox5.Size = new System.Drawing.Size(60, 60);
		this.pictureBox5.TabIndex = 19;
		this.pictureBox5.TabStop = false;
		this.label39.AutoSize = true;
		this.label39.Font = new System.Drawing.Font("Segoe UI", 12f, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, 0);
		this.label39.ForeColor = System.Drawing.Color.White;
		this.label39.Location = new System.Drawing.Point(165, 173);
		this.label39.Name = "label39";
		this.label39.Size = new System.Drawing.Size(313, 21);
		this.label39.TabIndex = 18;
		this.label39.Text = "IMPORTANTE: NO extenderá el tiempo total.";
		this.label36.AutoSize = true;
		this.label36.Font = new System.Drawing.Font("Segoe UI", 12f, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, 0);
		this.label36.ForeColor = System.Drawing.Color.White;
		this.label36.Location = new System.Drawing.Point(165, 108);
		this.label36.Name = "label36";
		this.label36.Size = new System.Drawing.Size(403, 21);
		this.label36.TabIndex = 18;
		this.label36.Text = "IMPORTANTE: El orden de las opciones a elegir cambiará.";
		this.label33.AutoSize = true;
		this.label33.Font = new System.Drawing.Font("Segoe UI", 12f, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, 0);
		this.label33.ForeColor = System.Drawing.Color.White;
		this.label33.Location = new System.Drawing.Point(165, 39);
		this.label33.Name = "label33";
		this.label33.Size = new System.Drawing.Size(491, 21);
		this.label33.TabIndex = 18;
		this.label33.Text = "IMPORTANTE: Una vez que se evalúe la pregunta NO podrás regresar.";
		this.label57.AutoSize = true;
		this.label57.Font = new System.Drawing.Font("Segoe UI", 12f, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, 0);
		this.label57.ForeColor = System.Drawing.Color.White;
		this.label57.Location = new System.Drawing.Point(165, 223);
		this.label57.Name = "label57";
		this.label57.Size = new System.Drawing.Size(375, 21);
		this.label57.TabIndex = 18;
		this.label57.Text = "Muestra la ayuda respecto al tipo de pregunta actual.";
		this.label38.AutoSize = true;
		this.label38.Font = new System.Drawing.Font("Segoe UI", 12f, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, 0);
		this.label38.ForeColor = System.Drawing.Color.White;
		this.label38.Location = new System.Drawing.Point(165, 152);
		this.label38.Name = "label38";
		this.label38.Size = new System.Drawing.Size(524, 21);
		this.label38.TabIndex = 18;
		this.label38.Text = "Dejará para después la pregunta actual y la pondrá al final para responder.";
		this.label35.AutoSize = true;
		this.label35.Font = new System.Drawing.Font("Segoe UI", 12f, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, 0);
		this.label35.ForeColor = System.Drawing.Color.White;
		this.label35.Location = new System.Drawing.Point(165, 85);
		this.label35.Name = "label35";
		this.label35.Size = new System.Drawing.Size(442, 21);
		this.label35.TabIndex = 18;
		this.label35.Text = "Reiniciará solo la pregunta actual. No reiniciará el tiempo total.";
		this.label37.Font = new System.Drawing.Font("Segoe UI", 12f, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, 0);
		this.label37.ForeColor = System.Drawing.Color.White;
		this.label37.Location = new System.Drawing.Point(69, 158);
		this.label37.Name = "label37";
		this.label37.Size = new System.Drawing.Size(90, 21);
		this.label37.TabIndex = 18;
		this.label37.Text = "Omitir:";
		this.label37.TextAlign = System.Drawing.ContentAlignment.MiddleRight;
		this.label34.Font = new System.Drawing.Font("Segoe UI", 12f, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, 0);
		this.label34.ForeColor = System.Drawing.Color.White;
		this.label34.Location = new System.Drawing.Point(69, 93);
		this.label34.Name = "label34";
		this.label34.Size = new System.Drawing.Size(90, 21);
		this.label34.TabIndex = 18;
		this.label34.Text = "Reiniciar:";
		this.label34.TextAlign = System.Drawing.ContentAlignment.MiddleRight;
		this.label31.Font = new System.Drawing.Font("Segoe UI", 12f, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, 0);
		this.label31.ForeColor = System.Drawing.Color.White;
		this.label31.Location = new System.Drawing.Point(69, 24);
		this.label31.Name = "label31";
		this.label31.Size = new System.Drawing.Size(90, 21);
		this.label31.TabIndex = 18;
		this.label31.Text = "Evaluar:";
		this.label31.TextAlign = System.Drawing.ContentAlignment.MiddleRight;
		this.pnlImportante.Controls.Add(this.label60);
		this.pnlImportante.Controls.Add(this.pictureBox9);
		this.pnlImportante.Controls.Add(this.pictureBox8);
		this.pnlImportante.Controls.Add(this.pictureBox7);
		this.pnlImportante.Controls.Add(this.label67);
		this.pnlImportante.Controls.Add(this.label64);
		this.pnlImportante.Controls.Add(this.label62);
		this.pnlImportante.Controls.Add(this.label29);
		this.pnlImportante.Controls.Add(this.label61);
		this.pnlImportante.Controls.Add(this.label65);
		this.pnlImportante.Location = new System.Drawing.Point(26, 141);
		this.pnlImportante.Name = "pnlImportante";
		this.pnlImportante.Size = new System.Drawing.Size(732, 267);
		this.pnlImportante.TabIndex = 45;
		this.label60.Font = new System.Drawing.Font("Segoe UI", 11.25f, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, 0);
		this.label60.ForeColor = System.Drawing.Color.White;
		this.label60.Location = new System.Drawing.Point(4, 137);
		this.label60.Name = "label60";
		this.label60.Size = new System.Drawing.Size(718, 126);
		this.label60.TabIndex = 54;
		this.label60.Text = "soporte@grupoeduit.com\r\nTeléfono: 01 800 808 6240 / WhatsApp: 22 21 65 6782\r\nHorario de atención: \r\nLunes a viernes de 9:00 am - 6:00 pm\r\nSábado de 9:00 am - 2:00 pm\r\nHora del centro de México.";
		this.label60.TextAlign = System.Drawing.ContentAlignment.TopCenter;
		this.pictureBox9.BackgroundImage = CulturaDigital.Properties.Resources.Check_vi;
		this.pictureBox9.BackgroundImageLayout = System.Windows.Forms.ImageLayout.Zoom;
		this.pictureBox9.Location = new System.Drawing.Point(18, 115);
		this.pictureBox9.Name = "pictureBox9";
		this.pictureBox9.Size = new System.Drawing.Size(10, 18);
		this.pictureBox9.TabIndex = 53;
		this.pictureBox9.TabStop = false;
		this.pictureBox8.BackgroundImage = CulturaDigital.Properties.Resources.Check_vi;
		this.pictureBox8.BackgroundImageLayout = System.Windows.Forms.ImageLayout.Zoom;
		this.pictureBox8.Location = new System.Drawing.Point(18, 75);
		this.pictureBox8.Name = "pictureBox8";
		this.pictureBox8.Size = new System.Drawing.Size(10, 18);
		this.pictureBox8.TabIndex = 52;
		this.pictureBox8.TabStop = false;
		this.pictureBox7.BackgroundImage = CulturaDigital.Properties.Resources.Check_vi;
		this.pictureBox7.BackgroundImageLayout = System.Windows.Forms.ImageLayout.Zoom;
		this.pictureBox7.Location = new System.Drawing.Point(18, 55);
		this.pictureBox7.Name = "pictureBox7";
		this.pictureBox7.Size = new System.Drawing.Size(10, 18);
		this.pictureBox7.TabIndex = 51;
		this.pictureBox7.TabStop = false;
		this.label67.AutoSize = true;
		this.label67.BackColor = System.Drawing.Color.Transparent;
		this.label67.Font = new System.Drawing.Font("Segoe UI", 12f, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, 0);
		this.label67.ForeColor = System.Drawing.Color.White;
		this.label67.Location = new System.Drawing.Point(40, 52);
		this.label67.Name = "label67";
		this.label67.Size = new System.Drawing.Size(639, 21);
		this.label67.TabIndex = 47;
		this.label67.Text = "Si continúas e interrumpes tu prueba, se calificarán solo las preguntas que hayas avanzado.";
		this.label64.AutoSize = true;
		this.label64.Font = new System.Drawing.Font("Segoe UI", 12f, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, 0);
		this.label64.ForeColor = System.Drawing.Color.White;
		this.label64.Location = new System.Drawing.Point(380, 25);
		this.label64.Name = "label64";
		this.label64.Size = new System.Drawing.Size(56, 21);
		this.label64.TabIndex = 46;
		this.label64.Text = "Cerrar";
		this.label62.AutoSize = true;
		this.label62.Font = new System.Drawing.Font("Segoe UI", 12f, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, 0);
		this.label62.ForeColor = System.Drawing.Color.White;
		this.label62.Location = new System.Drawing.Point(586, 4);
		this.label62.Name = "label62";
		this.label62.Size = new System.Drawing.Size(58, 21);
		this.label62.TabIndex = 45;
		this.label62.Text = "Iniciar";
		this.label29.Font = new System.Drawing.Font("Segoe UI", 12f, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, 0);
		this.label29.ForeColor = System.Drawing.Color.White;
		this.label29.Location = new System.Drawing.Point(18, 4);
		this.label29.Name = "label29";
		this.label29.Size = new System.Drawing.Size(691, 47);
		this.label29.TabIndex = 44;
		this.label29.Text = resources.GetString("label29.Text");
		this.label61.Font = new System.Drawing.Font("Segoe UI", 12f, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, 0);
		this.label61.ForeColor = System.Drawing.Color.White;
		this.label61.Location = new System.Drawing.Point(40, 112);
		this.label61.Name = "label61";
		this.label61.Size = new System.Drawing.Size(682, 21);
		this.label61.TabIndex = 21;
		this.label61.Text = "Si continúas experimentando alguna falla comunícate a:";
		this.label65.Font = new System.Drawing.Font("Segoe UI", 12f, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, 0);
		this.label65.ForeColor = System.Drawing.Color.White;
		this.label65.Location = new System.Drawing.Point(40, 72);
		this.label65.Name = "label65";
		this.label65.Size = new System.Drawing.Size(686, 43);
		this.label65.TabIndex = 18;
		this.label65.Text = "Si la computadora se bloquea o si ocurre una falla inesperada mientras estás realizando el examen, utiliza el Administrador de tareas de Windows para finalizar la aplicación.";
		this.pnlInfoReview.BackColor = System.Drawing.Color.Transparent;
		this.pnlInfoReview.Controls.Add(this.btnAceptarAviso);
		this.pnlInfoReview.Controls.Add(this.label28);
		this.pnlInfoReview.Controls.Add(this.label27);
		this.pnlInfoReview.Controls.Add(this.cbAvisoPrivacidad);
		this.pnlInfoReview.Controls.Add(this.btnNo);
		this.pnlInfoReview.Controls.Add(this.btnSi);
		this.pnlInfoReview.Controls.Add(this.pictureBox3);
		this.pnlInfoReview.Controls.Add(this.label22);
		this.pnlInfoReview.Controls.Add(this.label20);
		this.pnlInfoReview.Controls.Add(this.label25);
		this.pnlInfoReview.Controls.Add(this.label24);
		this.pnlInfoReview.Controls.Add(this.label21);
		this.pnlInfoReview.Controls.Add(this.label18);
		this.pnlInfoReview.Controls.Add(this.label19);
		this.pnlInfoReview.Controls.Add(this.label16);
		this.pnlInfoReview.Controls.Add(this.lblCURPUsuario);
		this.pnlInfoReview.Controls.Add(this.lblCorreoUsuario);
		this.pnlInfoReview.Controls.Add(this.lblNombreUsuario);
		this.pnlInfoReview.Controls.Add(this.lblPerfilUsuario);
		this.pnlInfoReview.Controls.Add(this.lblModalidadUsuario);
		this.pnlInfoReview.Controls.Add(this.lblFecha);
		this.pnlInfoReview.Controls.Add(this.lblOportunidadNo);
		this.pnlInfoReview.Controls.Add(this.label17);
		this.pnlInfoReview.Controls.Add(this.label13);
		this.pnlInfoReview.Controls.Add(this.label26);
		this.pnlInfoReview.Dock = System.Windows.Forms.DockStyle.Fill;
		this.pnlInfoReview.Location = new System.Drawing.Point(0, 0);
		this.pnlInfoReview.Name = "pnlInfoReview";
		this.pnlInfoReview.Size = new System.Drawing.Size(784, 491);
		this.pnlInfoReview.TabIndex = 3;
		this.btnAceptarAviso.FlatAppearance.BorderColor = System.Drawing.Color.White;
		this.btnAceptarAviso.FlatAppearance.BorderSize = 0;
		this.btnAceptarAviso.FlatAppearance.MouseDownBackColor = System.Drawing.Color.Transparent;
		this.btnAceptarAviso.FlatAppearance.MouseOverBackColor = System.Drawing.Color.Transparent;
		this.btnAceptarAviso.FlatStyle = System.Windows.Forms.FlatStyle.Flat;
		this.btnAceptarAviso.Font = new System.Drawing.Font("Segoe UI", 13f);
		this.btnAceptarAviso.ForeColor = System.Drawing.Color.White;
		this.btnAceptarAviso.Image = CulturaDigital.Properties.Resources.whitout;
		this.btnAceptarAviso.ImageAlign = System.Drawing.ContentAlignment.MiddleLeft;
		this.btnAceptarAviso.Location = new System.Drawing.Point(18, 427);
		this.btnAceptarAviso.Name = "btnAceptarAviso";
		this.btnAceptarAviso.Size = new System.Drawing.Size(295, 37);
		this.btnAceptarAviso.TabIndex = 39;
		this.btnAceptarAviso.Text = "Aceptar aviso de privacidad";
		this.btnAceptarAviso.TextAlign = System.Drawing.ContentAlignment.TopCenter;
		this.btnAceptarAviso.UseVisualStyleBackColor = true;
		this.btnAceptarAviso.Click += new System.EventHandler(button1_Click_1);
		this.label28.AutoSize = true;
		this.label28.BackColor = System.Drawing.Color.Transparent;
		this.label28.Font = new System.Drawing.Font("Segoe UI", 12f, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, 0);
		this.label28.ForeColor = System.Drawing.Color.White;
		this.label28.Location = new System.Drawing.Point(452, 329);
		this.label28.Name = "label28";
		this.label28.Size = new System.Drawing.Size(33, 21);
		this.label28.TabIndex = 38;
		this.label28.Text = "No";
		this.label27.Anchor = System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Left | System.Windows.Forms.AnchorStyles.Right;
		this.label27.BackColor = System.Drawing.Color.Transparent;
		this.label27.Font = new System.Drawing.Font("Segoe UI", 12f, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, 0);
		this.label27.ForeColor = System.Drawing.Color.White;
		this.label27.Location = new System.Drawing.Point(0, 468);
		this.label27.Name = "label27";
		this.label27.Size = new System.Drawing.Size(784, 21);
		this.label27.TabIndex = 37;
		this.label27.Text = "Copyright Evaluaasi 2017";
		this.label27.TextAlign = System.Drawing.ContentAlignment.MiddleCenter;
		this.cbAvisoPrivacidad.Anchor = System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Left;
		this.cbAvisoPrivacidad.AutoSize = true;
		this.cbAvisoPrivacidad.Font = new System.Drawing.Font("Segoe UI", 14.25f, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, 0);
		this.cbAvisoPrivacidad.ForeColor = System.Drawing.Color.White;
		this.cbAvisoPrivacidad.Location = new System.Drawing.Point(281, 399);
		this.cbAvisoPrivacidad.Name = "cbAvisoPrivacidad";
		this.cbAvisoPrivacidad.Size = new System.Drawing.Size(263, 29);
		this.cbAvisoPrivacidad.TabIndex = 36;
		this.cbAvisoPrivacidad.Text = "Aceptar aviso de privacidad";
		this.cbAvisoPrivacidad.UseVisualStyleBackColor = true;
		this.cbAvisoPrivacidad.Visible = false;
		this.cbAvisoPrivacidad.CheckedChanged += new System.EventHandler(cbAvisoPrivacidad_CheckedChanged);
		this.btnNo.Anchor = System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Right;
		this.btnNo.BackColor = System.Drawing.Color.Transparent;
		this.btnNo.FlatAppearance.BorderColor = System.Drawing.Color.White;
		this.btnNo.FlatAppearance.BorderSize = 2;
		this.btnNo.FlatAppearance.MouseDownBackColor = System.Drawing.Color.FromArgb(255, 109, 14);
		this.btnNo.FlatAppearance.MouseOverBackColor = System.Drawing.Color.FromArgb(254, 185, 20);
		this.btnNo.FlatStyle = System.Windows.Forms.FlatStyle.Flat;
		this.btnNo.Font = new System.Drawing.Font("Segoe UI", 13f);
		this.btnNo.ForeColor = System.Drawing.Color.White;
		this.btnNo.Location = new System.Drawing.Point(559, 430);
		this.btnNo.Name = "btnNo";
		this.btnNo.Size = new System.Drawing.Size(101, 38);
		this.btnNo.TabIndex = 34;
		this.btnNo.Text = "No";
		this.btnNo.UseVisualStyleBackColor = false;
		this.btnNo.Click += new System.EventHandler(btnNo_Click_1);
		this.btnSi.Anchor = System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Right;
		this.btnSi.BackColor = System.Drawing.Color.Transparent;
		this.btnSi.FlatAppearance.BorderColor = System.Drawing.Color.White;
		this.btnSi.FlatAppearance.BorderSize = 2;
		this.btnSi.FlatAppearance.MouseDownBackColor = System.Drawing.Color.FromArgb(17, 113, 174);
		this.btnSi.FlatAppearance.MouseOverBackColor = System.Drawing.Color.FromArgb(21, 163, 239);
		this.btnSi.FlatStyle = System.Windows.Forms.FlatStyle.Flat;
		this.btnSi.Font = new System.Drawing.Font("Segoe UI", 13f);
		this.btnSi.ForeColor = System.Drawing.Color.White;
		this.btnSi.Location = new System.Drawing.Point(666, 430);
		this.btnSi.Name = "btnSi";
		this.btnSi.Size = new System.Drawing.Size(101, 38);
		this.btnSi.TabIndex = 35;
		this.btnSi.Text = "Acepto";
		this.btnSi.UseVisualStyleBackColor = false;
		this.btnSi.Visible = false;
		this.btnSi.Click += new System.EventHandler(btnSi_Click_1);
		this.pictureBox3.BackgroundImage = CulturaDigital.Properties.Resources.logo_blanco;
		this.pictureBox3.BackgroundImageLayout = System.Windows.Forms.ImageLayout.Zoom;
		this.pictureBox3.Dock = System.Windows.Forms.DockStyle.Top;
		this.pictureBox3.Location = new System.Drawing.Point(0, 0);
		this.pictureBox3.Name = "pictureBox3";
		this.pictureBox3.Size = new System.Drawing.Size(784, 51);
		this.pictureBox3.TabIndex = 33;
		this.pictureBox3.TabStop = false;
		this.label22.AutoSize = true;
		this.label22.Font = new System.Drawing.Font("Segoe UI", 12f, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, 0);
		this.label22.ForeColor = System.Drawing.Color.White;
		this.label22.Location = new System.Drawing.Point(162, 371);
		this.label22.Name = "label22";
		this.label22.Size = new System.Drawing.Size(114, 21);
		this.label22.TabIndex = 27;
		this.label22.Text = "para continuar.";
		this.label20.AutoSize = true;
		this.label20.BackColor = System.Drawing.Color.Transparent;
		this.label20.Font = new System.Drawing.Font("Segoe UI", 12f, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, 0);
		this.label20.ForeColor = System.Drawing.Color.White;
		this.label20.Location = new System.Drawing.Point(103, 371);
		this.label20.Name = "label20";
		this.label20.Size = new System.Drawing.Size(64, 21);
		this.label20.TabIndex = 26;
		this.label20.Text = "Acepto";
		this.label25.BackColor = System.Drawing.Color.Transparent;
		this.label25.Font = new System.Drawing.Font("Segoe UI", 12f, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, 0);
		this.label25.ForeColor = System.Drawing.Color.White;
		this.label25.Location = new System.Drawing.Point(55, 330);
		this.label25.Name = "label25";
		this.label25.Size = new System.Drawing.Size(672, 74);
		this.label25.TabIndex = 24;
		this.label25.Text = "Si tus datos son incorrectos, por favor, da clic en el botón        y avisa a tu profesor, en caso contrario acepta nuestro aviso de privacidad marcando la casilla de verificación y da clic al botón";
		this.label24.AutoSize = true;
		this.label24.Font = new System.Drawing.Font("Segoe UI", 12f, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, 0);
		this.label24.ForeColor = System.Drawing.Color.White;
		this.label24.Location = new System.Drawing.Point(55, 288);
		this.label24.Name = "label24";
		this.label24.Size = new System.Drawing.Size(61, 21);
		this.label24.TabIndex = 23;
		this.label24.Text = "CURP : ";
		this.label21.AutoSize = true;
		this.label21.Font = new System.Drawing.Font("Segoe UI", 12f, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, 0);
		this.label21.ForeColor = System.Drawing.Color.White;
		this.label21.Location = new System.Drawing.Point(55, 257);
		this.label21.Name = "label21";
		this.label21.Size = new System.Drawing.Size(142, 21);
		this.label21.TabIndex = 22;
		this.label21.Text = "Correo eletrónico : ";
		this.label18.AutoSize = true;
		this.label18.Font = new System.Drawing.Font("Segoe UI", 12f, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, 0);
		this.label18.ForeColor = System.Drawing.Color.White;
		this.label18.Location = new System.Drawing.Point(55, 228);
		this.label18.Name = "label18";
		this.label18.Size = new System.Drawing.Size(79, 21);
		this.label18.TabIndex = 21;
		this.label18.Text = "Nombre : ";
		this.label19.AutoSize = true;
		this.label19.Font = new System.Drawing.Font("Segoe UI", 12f, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, 0);
		this.label19.ForeColor = System.Drawing.Color.White;
		this.label19.Location = new System.Drawing.Point(55, 196);
		this.label19.Name = "label19";
		this.label19.Size = new System.Drawing.Size(389, 21);
		this.label19.TabIndex = 25;
		this.label19.Text = "El voucher asignado corresponde a un usuario de tipo :";
		this.label16.AutoSize = true;
		this.label16.Font = new System.Drawing.Font("Segoe UI", 12f, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, 0);
		this.label16.ForeColor = System.Drawing.Color.White;
		this.label16.Location = new System.Drawing.Point(196, 108);
		this.label16.Name = "label16";
		this.label16.Size = new System.Drawing.Size(421, 21);
		this.label16.TabIndex = 19;
		this.label16.Text = "oportunidad, revisa los siguientes datos antes de comenzar:";
		this.lblCURPUsuario.AutoSize = true;
		this.lblCURPUsuario.Font = new System.Drawing.Font("Segoe UI", 12f, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, 0);
		this.lblCURPUsuario.ForeColor = System.Drawing.Color.White;
		this.lblCURPUsuario.Location = new System.Drawing.Point(204, 288);
		this.lblCURPUsuario.Name = "lblCURPUsuario";
		this.lblCURPUsuario.Size = new System.Drawing.Size(73, 21);
		this.lblCURPUsuario.TabIndex = 10;
		this.lblCURPUsuario.Text = "Septima";
		this.lblCorreoUsuario.AutoSize = true;
		this.lblCorreoUsuario.Font = new System.Drawing.Font("Segoe UI", 12f, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, 0);
		this.lblCorreoUsuario.ForeColor = System.Drawing.Color.White;
		this.lblCorreoUsuario.Location = new System.Drawing.Point(204, 257);
		this.lblCorreoUsuario.Name = "lblCorreoUsuario";
		this.lblCorreoUsuario.Size = new System.Drawing.Size(73, 21);
		this.lblCorreoUsuario.TabIndex = 17;
		this.lblCorreoUsuario.Text = "Septima";
		this.lblNombreUsuario.AutoSize = true;
		this.lblNombreUsuario.Font = new System.Drawing.Font("Segoe UI", 12f, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, 0);
		this.lblNombreUsuario.ForeColor = System.Drawing.Color.White;
		this.lblNombreUsuario.Location = new System.Drawing.Point(204, 228);
		this.lblNombreUsuario.Name = "lblNombreUsuario";
		this.lblNombreUsuario.Size = new System.Drawing.Size(73, 21);
		this.lblNombreUsuario.TabIndex = 16;
		this.lblNombreUsuario.Text = "Septima";
		this.lblPerfilUsuario.AutoSize = true;
		this.lblPerfilUsuario.Font = new System.Drawing.Font("Segoe UI", 12f, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, 0);
		this.lblPerfilUsuario.ForeColor = System.Drawing.Color.White;
		this.lblPerfilUsuario.Location = new System.Drawing.Point(446, 196);
		this.lblPerfilUsuario.Name = "lblPerfilUsuario";
		this.lblPerfilUsuario.Size = new System.Drawing.Size(73, 21);
		this.lblPerfilUsuario.TabIndex = 15;
		this.lblPerfilUsuario.Text = "Septima";
		this.lblModalidadUsuario.AutoSize = true;
		this.lblModalidadUsuario.Font = new System.Drawing.Font("Segoe UI", 12f, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, 0);
		this.lblModalidadUsuario.ForeColor = System.Drawing.Color.White;
		this.lblModalidadUsuario.Location = new System.Drawing.Point(204, 165);
		this.lblModalidadUsuario.Name = "lblModalidadUsuario";
		this.lblModalidadUsuario.Size = new System.Drawing.Size(73, 21);
		this.lblModalidadUsuario.TabIndex = 14;
		this.lblModalidadUsuario.Text = "Septima";
		this.lblFecha.AutoSize = true;
		this.lblFecha.Font = new System.Drawing.Font("Segoe UI", 12f, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, 0);
		this.lblFecha.ForeColor = System.Drawing.Color.White;
		this.lblFecha.Location = new System.Drawing.Point(204, 138);
		this.lblFecha.Name = "lblFecha";
		this.lblFecha.Size = new System.Drawing.Size(73, 21);
		this.lblFecha.TabIndex = 13;
		this.lblFecha.Text = "Septima";
		this.lblOportunidadNo.Font = new System.Drawing.Font("Segoe UI", 12f, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point, 0);
		this.lblOportunidadNo.ForeColor = System.Drawing.Color.White;
		this.lblOportunidadNo.Location = new System.Drawing.Point(127, 109);
		this.lblOportunidadNo.Name = "lblOportunidadNo";
		this.lblOportunidadNo.Size = new System.Drawing.Size(77, 19);
		this.lblOportunidadNo.TabIndex = 12;
		this.lblOportunidadNo.Text = "Septima";
		this.lblOportunidadNo.TextAlign = System.Drawing.ContentAlignment.MiddleCenter;
		this.label17.AutoSize = true;
		this.label17.Font = new System.Drawing.Font("Segoe UI", 12f, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, 0);
		this.label17.ForeColor = System.Drawing.Color.White;
		this.label17.Location = new System.Drawing.Point(55, 165);
		this.label17.Name = "label17";
		this.label17.Size = new System.Drawing.Size(95, 21);
		this.label17.TabIndex = 11;
		this.label17.Text = "Modalidad : ";
		this.label13.AutoSize = true;
		this.label13.Font = new System.Drawing.Font("Segoe UI", 12f, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, 0);
		this.label13.ForeColor = System.Drawing.Color.White;
		this.label13.Location = new System.Drawing.Point(55, 138);
		this.label13.Name = "label13";
		this.label13.Size = new System.Drawing.Size(155, 21);
		this.label13.TabIndex = 20;
		this.label13.Text = "Fecha de aplicación : ";
		this.label26.AutoSize = true;
		this.label26.Font = new System.Drawing.Font("Segoe UI", 12f, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, 0);
		this.label26.ForeColor = System.Drawing.Color.White;
		this.label26.Location = new System.Drawing.Point(55, 108);
		this.label26.Name = "label26";
		this.label26.Size = new System.Drawing.Size(79, 21);
		this.label26.TabIndex = 18;
		this.label26.Text = "Esta es tu ";
		this.bgwLoad.WorkerReportsProgress = true;
		this.bgwLoad.WorkerSupportsCancellation = true;
		this.bgwLoad.DoWork += new System.ComponentModel.DoWorkEventHandler(bgwLoad_DoWork);
		this.bgwLoad.ProgressChanged += new System.ComponentModel.ProgressChangedEventHandler(bgwLoad_ProgressChanged);
		this.bgwLoad.RunWorkerCompleted += new System.ComponentModel.RunWorkerCompletedEventHandler(bgwLoad_RunWorkerCompleted);
		this.bgwLoadQuestions.WorkerReportsProgress = true;
		this.bgwLoadQuestions.WorkerSupportsCancellation = true;
		this.bgwLoadQuestions.DoWork += new System.ComponentModel.DoWorkEventHandler(bgwLoadQuestions_DoWork);
		this.bgwLoadQuestions.ProgressChanged += new System.ComponentModel.ProgressChangedEventHandler(bgwLoadQuestions_ProgressChanged);
		this.bgwLoadQuestions.RunWorkerCompleted += new System.ComponentModel.RunWorkerCompletedEventHandler(bgwLoadQuestions_RunWorkerCompleted);
		base.AutoScaleDimensions = new System.Drawing.SizeF(6f, 13f);
		base.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
		this.BackColor = System.Drawing.Color.FromArgb(0, 52, 106);
		base.ClientSize = new System.Drawing.Size(784, 561);
		base.Controls.Add(this.pnlContenedorPaneles);
		base.Controls.Add(this.pnlTitle);
		base.FormBorderStyle = System.Windows.Forms.FormBorderStyle.None;
		base.Icon = (System.Drawing.Icon)resources.GetObject("$this.Icon");
		base.Name = "CulturaDigital_Inicio";
		base.StartPosition = System.Windows.Forms.FormStartPosition.CenterScreen;
		this.Text = "Inicio";
		base.Load += new System.EventHandler(Inicio_Load);
		this.pnlTitle.ResumeLayout(false);
		this.pnlTitle.PerformLayout();
		((System.ComponentModel.ISupportInitialize)this.pbtitulo).EndInit();
		this.pnlContenedorPaneles.ResumeLayout(false);
		this.pnlLogin.ResumeLayout(false);
		((System.ComponentModel.ISupportInitialize)this.pblogin1).EndInit();
		this.pnlimagencelular.ResumeLayout(false);
		this.pnlimagencelular.PerformLayout();
		((System.ComponentModel.ISupportInitialize)this.LoginPictureBox).EndInit();
		((System.ComponentModel.ISupportInitialize)this.pbSpinner).EndInit();
		this.PnlBienvenido.ResumeLayout(false);
		this.PnlBienvenido.PerformLayout();
		((System.ComponentModel.ISupportInitialize)this.pictureBox2).EndInit();
		this.PnlInstrucciones.ResumeLayout(false);
		((System.ComponentModel.ISupportInitialize)this.pictureBox4).EndInit();
		this.pnlInfoControlesArrastrar.ResumeLayout(false);
		this.pnlInfoControlesArrastrar.PerformLayout();
		this.pnlInfoControlesReloj.ResumeLayout(false);
		this.pnlInfoControlesReloj.PerformLayout();
		this.pnlContenedorTotales.ResumeLayout(false);
		this.pnlContenedorTotales.PerformLayout();
		this.pnlContenedorTimmer.ResumeLayout(false);
		this.pnlInfoControlesButtons.ResumeLayout(false);
		this.pnlInfoControlesButtons.PerformLayout();
		((System.ComponentModel.ISupportInitialize)this.pictureBox5).EndInit();
		this.pnlImportante.ResumeLayout(false);
		this.pnlImportante.PerformLayout();
		((System.ComponentModel.ISupportInitialize)this.pictureBox9).EndInit();
		((System.ComponentModel.ISupportInitialize)this.pictureBox8).EndInit();
		((System.ComponentModel.ISupportInitialize)this.pictureBox7).EndInit();
		this.pnlInfoReview.ResumeLayout(false);
		this.pnlInfoReview.PerformLayout();
		((System.ComponentModel.ISupportInitialize)this.pictureBox3).EndInit();
		base.ResumeLayout(false);
	}
}
