using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Linq;
using System.Text;
using System.Xml;
using System.Xml.Serialization;
using Gma.QrCodeNet.Encoding;
using Gma.QrCodeNet.Encoding.Windows.Render;

namespace CulturaDigital.Models.Extensions;

public static class StringExtensions
{
	public static bool ComparaVersionDB(this string archivo, string servicio)
	{
		bool result = true;
		try
		{
			string[] array = archivo.Split('.');
			string[] array2 = servicio.Split('.');
			for (int i = 0; i < array2.Length; i++)
			{
				if (int.Parse(array2[i]) > int.Parse(array[i]))
				{
					result = false;
					break;
				}
			}
		}
		catch (Exception)
		{
			result = false;
		}
		return result;
	}

	public static StreamReader GenerateStreamReaderFromString(this string s)
	{
		return new StreamReader(new MemoryStream(Encoding.ASCII.GetBytes(s)));
	}

	public static T Deserialize<T>(this string xml)
	{
		if (string.IsNullOrEmpty(xml))
		{
			return default(T);
		}
		XmlSerializer xmlSerializer = new XmlSerializer(typeof(T));
		XmlReaderSettings settings = new XmlReaderSettings();
		using StringReader input = new StringReader(xml);
		using XmlReader xmlReader = XmlReader.Create(input, settings);
		return (T)xmlSerializer.Deserialize(xmlReader);
	}

	public static string TFString(this string value)
	{
		string text = value.ToLower();
		if (!(text == "false"))
		{
			if (text == "true")
			{
				return "Correcta";
			}
			return string.Empty;
		}
		return "Incorrecta";
	}

	public static Image GenerarQR(this string cadena)
	{
		QrCode qrCode = new QrEncoder(ErrorCorrectionLevel.H).Encode(cadena);
		MemoryStream stream = new MemoryStream();
		new GraphicsRenderer(new FixedModuleSize(5, QuietZoneModules.Two), Brushes.Gray, Brushes.White).WriteToStream(qrCode.Matrix, ImageFormat.Png, stream);
		return Image.FromStream(stream);
	}

	public static string EncriptaTexto(this string valor, Meses MesEncripcion)
	{
		Rango rango = new Rango();
		string text = "";
		char[] array = valor.ToCharArray();
		int num = 0;
		char[] array2 = array;
		for (int i = 0; i < array2.Length; i++)
		{
			char c = array2[i];
			if (c == '\r' || c == '\n')
			{
				text += c;
			}
			else
			{
				int num2 = Array.IndexOf(rango.arreglo, c);
				if (num2 + MesEncripcion.Valor >= rango.arreglo.Length)
				{
					int num3 = num2 + MesEncripcion.Valor - rango.arreglo.Length;
					text += rango.arreglo[num3];
				}
				else
				{
					text += rango.arreglo[num2 + MesEncripcion.Valor];
				}
			}
			num++;
		}
		return text;
	}

	public static string EncriptaTexto(this string valor, Meses MesEncripcion, ref List<Elemento> ele)
	{
		Rango rango = new Rango();
		string text = "";
		string[] array = valor.Split(new string[2]
		{
			Environment.NewLine,
			"\n"
		}, StringSplitOptions.None);
		int num = array.Length;
		int num2 = 1;
		string[] array2 = array;
		for (int i = 0; i < array2.Length; i++)
		{
			char[] array3 = array2[i].ToCharArray();
			int num3 = 0;
			int num4 = array3.Length - 1;
			char[] array4 = array3;
			for (int j = 0; j < array4.Length; j++)
			{
				char c = array4[j];
				Elemento elemento = new Elemento();
				elemento.Caracter = c;
				elemento.Valor = c;
				elemento.Posicion = num3;
				elemento.PosicionConvertido = num4 - num3;
				if (c == '\r' || c == '\n')
				{
					text += c;
				}
				else
				{
					int num5 = Array.IndexOf(rango.arreglo, c);
					if ((num3 + 1) % 2 == 0)
					{
						if (num5 + MesEncripcion.Valor >= rango.arreglo.Length)
						{
							int num6 = num5 + MesEncripcion.Valor - rango.arreglo.Length;
							text += rango.arreglo[num6];
							elemento.CaracterConvertido = rango.arreglo[num6];
							elemento.ValorConvertido = num6;
						}
						else
						{
							text += rango.arreglo[num5 + MesEncripcion.Valor];
							elemento.CaracterConvertido = rango.arreglo[num5 + MesEncripcion.Valor];
							elemento.ValorConvertido = num5 + MesEncripcion.Valor;
						}
					}
					else if (num5 - MesEncripcion.Valor >= rango.arreglo.Length)
					{
						int num7 = num5 - MesEncripcion.Valor - rango.arreglo.Length;
						text += rango.arreglo[num7];
						elemento.CaracterConvertido = rango.arreglo[num7];
						elemento.ValorConvertido = num7;
					}
					else if (num5 - MesEncripcion.Valor < 0)
					{
						int num8 = num5 - MesEncripcion.Valor;
						int valorConvertido = rango.arreglo.Length + num8;
						text += rango.arreglo[rango.arreglo.Length + (num5 - MesEncripcion.Valor)];
						elemento.CaracterConvertido = rango.arreglo[rango.arreglo.Length + (num5 - MesEncripcion.Valor)];
						elemento.ValorConvertido = valorConvertido;
					}
					else
					{
						text += rango.arreglo[num5 - MesEncripcion.Valor];
						elemento.CaracterConvertido = rango.arreglo[num5 - MesEncripcion.Valor];
						elemento.ValorConvertido = num5 - MesEncripcion.Valor;
					}
				}
				num3++;
				ele.Add(elemento);
			}
			if (num2 < num)
			{
				text += "\n";
			}
			num2++;
		}
		return text;
	}

	public static string ReverseString(this string s)
	{
		char[] array = s.ToCharArray();
		Array.Reverse(array);
		return new string(array);
	}

	public static string DesencriptaTexto(this string valor, Meses MesEncripcion)
	{
		Rango rango = new Rango();
		string text = "";
		string[] array = valor.Split(new string[2]
		{
			Environment.NewLine,
			"\n"
		}, StringSplitOptions.None);
		int num = array.Length;
		int num2 = 1;
		string[] array2 = array;
		for (int i = 0; i < array2.Length; i++)
		{
			char[] array3 = array2[i].ToCharArray();
			int num3 = 0;
			_ = array3.Length;
			char[] array4 = array3;
			for (int j = 0; j < array4.Length; j++)
			{
				char c = array4[j];
				if (c == '\r' || c == '\n')
				{
					text += c;
				}
				else
				{
					int num4 = Array.IndexOf(rango.arreglo, c);
					if ((num3 + 1) % 2 == 0)
					{
						text = ((num4 >= MesEncripcion.Valor) ? (text + rango.arreglo[num4 - MesEncripcion.Valor]) : (text + rango.arreglo[rango.arreglo.Length + (num4 - MesEncripcion.Valor)]));
					}
					else if (num4 + MesEncripcion.Valor < rango.arreglo.Length)
					{
						text += rango.arreglo[num4 + MesEncripcion.Valor];
					}
					else if (num4 + MesEncripcion.Valor >= rango.arreglo.Length)
					{
						int num5 = num4 + MesEncripcion.Valor - (rango.arreglo.Length - 1);
						text += rango.arreglo[num5 - 1];
					}
					else
					{
						text = ((num4 <= MesEncripcion.Valor || num4 >= rango.arreglo.Length) ? (text + rango.arreglo[num4 - rango.arreglo.Length]) : (text + rango.arreglo[num4 + MesEncripcion.Valor]));
					}
				}
				num3++;
			}
			if (num2 < num)
			{
				text += "\n";
			}
			num2++;
		}
		return text.Replace("ÿ", " ");
	}

	public static string DesencriptaTexto(this string valor, Meses MesEncripcion, ref List<Elemento> ele)
	{
		Rango rango = new Rango();
		string text = "";
		string[] array = valor.Split(new string[2]
		{
			Environment.NewLine,
			"\n"
		}, StringSplitOptions.None);
		int num = array.Length;
		int num2 = 1;
		string[] array2 = array;
		for (int i = 0; i < array2.Length; i++)
		{
			char[] array3 = array2[i].ToCharArray();
			int num3 = 0;
			int num4 = array3.Length - 1;
			char[] array4 = array3;
			for (int j = 0; j < array4.Length; j++)
			{
				char c = array4[j];
				Elemento elemento = new Elemento();
				elemento.Caracter = c;
				elemento.Valor = c;
				elemento.Posicion = num3;
				elemento.PosicionConvertido = num4 - num3;
				if (c == '\r' || c == '\n')
				{
					text += c;
				}
				else
				{
					int num5 = Array.IndexOf(rango.arreglo, c);
					if ((num3 + 1) % 2 == 0)
					{
						text = ((num5 >= MesEncripcion.Valor) ? (text + rango.arreglo[num5 - MesEncripcion.Valor]) : (text + rango.arreglo[rango.arreglo.Length + (num5 - MesEncripcion.Valor)]));
					}
					else if (num5 + MesEncripcion.Valor < rango.arreglo.Length)
					{
						text += rango.arreglo[num5 + MesEncripcion.Valor];
					}
					else if (num5 + MesEncripcion.Valor >= rango.arreglo.Length)
					{
						int num6 = num5 + MesEncripcion.Valor - (rango.arreglo.Length - 1);
						text += rango.arreglo[num6 - 1];
					}
					else
					{
						text = ((num5 <= MesEncripcion.Valor || num5 >= rango.arreglo.Length) ? (text + rango.arreglo[num5 - rango.arreglo.Length]) : (text + rango.arreglo[num5 + MesEncripcion.Valor]));
					}
				}
				num3++;
				ele.Add(elemento);
			}
			if (num2 < num)
			{
				text += "\n";
			}
			num2++;
		}
		return text;
	}

	public static char[] GetChar(this string valor)
	{
		return valor.ToCharArray();
	}

	public static int GetIntMes(this string mesString)
	{
		int result = 0;
		switch (mesString)
		{
		case "A":
			result = 12;
			break;
		case "B":
			result = 11;
			break;
		case "C":
			result = 10;
			break;
		case "D":
			result = 9;
			break;
		case "E":
			result = 8;
			break;
		case "F":
			result = 7;
			break;
		case "G":
			result = 6;
			break;
		case "H":
			result = 5;
			break;
		case "I":
			result = 4;
			break;
		case "J":
			result = 3;
			break;
		case "K":
			result = 2;
			break;
		case "L":
			result = 1;
			break;
		}
		return result;
	}

	public static bool Bitacora(this string texto, string Id, string modulo, string proceso, string Linea, string Emergente)
	{
		bool result = false;
		try
		{
			if (!Directory.Exists("Bitacora"))
			{
				Directory.CreateDirectory("Bitacora");
			}
			FileInfo fileInfo = new FileInfo("Bitacora\\Bitacora_" + Environment.MachineName.Replace(" ", "_") + ".txt");
			if (!fileInfo.Exists)
			{
				File.AppendAllText("Bitacora\\Bitacora_" + Environment.MachineName.Replace(" ", "_") + ".txt", "        Fecha       \t  Id  \t                        Mensaje                         \tMódulo\tProceso\tLínea\tEmergente\tTamaño");
				File.AppendAllText("Bitacora\\Bitacora_" + Environment.MachineName.Replace(" ", "_") + ".txt", Environment.NewLine + DateTime.Now.ProcesarFecha() + "\t" + Id + "\t" + texto + "\t" + modulo + "\t" + proceso + "\t" + Linea + "\t" + Emergente + "     \t0");
			}
			else
			{
				File.AppendAllText("Bitacora\\Bitacora_" + Environment.MachineName.Replace(" ", "_") + ".txt", Environment.NewLine + DateTime.Now.ProcesarFecha() + "\t" + Id + "\t" + texto + "\t" + modulo + "\t" + proceso + "\t" + Linea + "\t" + Emergente + "     \t" + fileInfo.Length);
			}
			result = true;
		}
		catch (Exception)
		{
		}
		return result;
	}

	public static bool ComparaVersionDB(this string VersionBD)
	{
		bool flag = false;
		try
		{
			string[] array = VersionBD.Split('.');
			string[] array2 = "1.0.0.4".Split('.');
			if (array[0] == array2[0])
			{
				if (int.Parse(array[1]) >= int.Parse(array2[1]))
				{
					if (int.Parse(array[2]) >= int.Parse(array2[2]))
					{
						if (int.Parse(array[3]) >= int.Parse(array2[3]))
						{
							return true;
						}
						return false;
					}
					return false;
				}
				return false;
			}
			return false;
		}
		catch (Exception)
		{
			return false;
		}
	}

	public static bool ComparaVersionApp(this string VersionBD, string versionapp)
	{
		bool flag = false;
		try
		{
			string[] array = VersionBD.Split('.');
			string[] array2 = versionapp.Split('.');
			if (array[0] == array2[0])
			{
				if (int.Parse(array[1]) == int.Parse(array2[1]))
				{
					if (int.Parse(array[2]) == int.Parse(array2[2]))
					{
						if (int.Parse(array[3]) <= int.Parse(array2[3]))
						{
							return true;
						}
						return false;
					}
					return false;
				}
				return false;
			}
			return false;
		}
		catch (Exception)
		{
			return false;
		}
	}

	public static Evaluacion Cargar(this string ruta)
	{
		Evaluacion evaluacion = new Evaluacion();
		try
		{
			StreamReader streamReader = new StreamReader(ruta, Encoding.UTF8);
			Encripcion encripcion = new Encripcion(13, streamReader.ReadToEnd());
			streamReader.Dispose();
			streamReader.Close();
			MemoryStream stream = new MemoryStream(Encoding.UTF8.GetBytes(encripcion.TextoNormal2));
			return new XmlSerializer(typeof(Evaluacion), "Evaluacion").Deserialize(stream) as Evaluacion;
		}
		catch (Exception)
		{
			return new Evaluacion();
		}
	}

	public static string RegresaNivelesURL(this string ruta, int niveles)
	{
		string text = "";
		try
		{
			string[] array = ruta.Split('\\');
			for (int i = 0; i < array.Length - niveles; i++)
			{
				text = ((i != array.Length - niveles - 1) ? (text + array[i] + "\\") : (text + array[i]));
			}
		}
		catch (Exception)
		{
			text = "";
		}
		return text;
	}

	public static string ObtieneTipo(this eTipoPregunta valor)
	{
		string result = string.Empty;
		switch (valor)
		{
		case eTipoPregunta.OpcionMultiple:
			result = "Opción múltiple";
			break;
		case eTipoPregunta.SeleccionMultiple:
			result = "Selección múltiple";
			break;
		case eTipoPregunta.ArrastrarSoltar:
			result = "Arrastrar y soltar";
			break;
		case eTipoPregunta.Ordenamiento:
			result = "Ordenamiento";
			break;
		case eTipoPregunta.TrueFalse:
			result = "Verdadero/Falso";
			break;
		case eTipoPregunta.OrdenarPanelDragDrop:
			result = "Arrastrar y ordenar";
			break;
		}
		return result;
	}

	public static bool EsAlguno(this string valor, params string[] valores)
	{
		return valores.Contains(valor);
	}
}
