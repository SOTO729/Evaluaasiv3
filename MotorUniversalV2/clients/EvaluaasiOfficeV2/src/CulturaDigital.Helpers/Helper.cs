using System;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Management;
using System.Net;
using CulturaDigital.Models.Extensions;

namespace CulturaDigital.Helpers;

public class Helper
{
	private static string MACAddress = string.Empty;

	private static string localIP = string.Empty;

	public bool Conexion()
	{
		Uri requestUri = new Uri("https://srvcsvls7-1.azurewebsites.net/Usuario.asmx");
		try
		{
			ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls | SecurityProtocolType.Tls11 | SecurityProtocolType.Tls12;
			WebRequest webRequest = WebRequest.Create(requestUri);
			webRequest.Timeout = 5000;
			webRequest.GetResponse().Close();
			return true;
		}
		catch (Exception)
		{
			return false;
		}
	}

	public void EnviarTelemetria(int plantelId, int subsistemaId, int licenciaId, string nombrePlantel, string version, string usuario, int online, int accion, int calificacion)
	{
		try
		{
			new ThumbPrint().Value();
		}
		catch (Exception ex)
		{
			ex.Message.Bitacora("000004", "Telemetria", "Error ", "000266", "000008");
		}
	}

	public string ObtenerMAC()
	{
		try
		{
			if (string.IsNullOrEmpty(MACAddress))
			{
				foreach (ManagementObject instance in new ManagementClass("Win32_NetworkAdapterConfiguration").GetInstances())
				{
					if (MACAddress == string.Empty && (bool)instance["IPEnabled"])
					{
						MACAddress = instance["MacAddress"].ToString();
					}
					instance.Dispose();
				}
				MACAddress = MACAddress.Replace(":", "");
			}
		}
		catch (Exception)
		{
		}
		return MACAddress;
	}

	public string ObtenerIP()
	{
		try
		{
			if (string.IsNullOrEmpty(localIP))
			{
				localIP = Dns.GetHostEntry(Dns.GetHostName()).AddressList.Where((IPAddress m) => m.AddressFamily.ToString() == "InterNetwork").First().ToString();
			}
		}
		catch (Exception)
		{
			localIP = "?";
		}
		return localIP;
	}

	public static string ObtenerSistemaOperativo()
	{
		string result = string.Empty;
		using (ManagementObjectCollection.ManagementObjectEnumerator managementObjectEnumerator = new ManagementObjectSearcher("SELECT Caption FROM Win32_OperatingSystem").Get().GetEnumerator())
		{
			if (managementObjectEnumerator.MoveNext())
			{
				result = ((ManagementObject)managementObjectEnumerator.Current)["Caption"].ToString();
			}
		}
		return result;
	}

	public static void UnZip(string version, string path)
	{
		ZipFile.ExtractToDirectory($"ExamenV{version}.zip", Path.Combine(path, $"ExamenV{version}/"));
		DirectoryInfo directoryInfo = new DirectoryInfo(Path.Combine(path, $"ExamenV{version}/"));
		foreach (FileInfo item in directoryInfo.GetFiles().ToList())
		{
			try
			{
				if (!item.Extension.ToUpper().Equals(".EXE") || !item.Extension.ToUpper().Equals(".TXT"))
				{
					File.SetAttributes(Path.Combine(path, $"ExamenV{version}/{item.Name}"), FileAttributes.Hidden);
				}
				File.Move(Path.Combine(path, $"ExamenV{version}/{item.Name}"), Path.Combine(path, item.Name));
			}
			catch (Exception ex)
			{
				_ = ex.Message;
			}
		}
		try
		{
			File.SetAttributes(Path.Combine(path, $"ExamenV{version}.zip"), FileAttributes.Hidden);
			directoryInfo.Attributes = FileAttributes.Hidden | FileAttributes.Directory;
		}
		catch (Exception)
		{
		}
	}

	public static void Clean(string path, string current)
	{
		try
		{
			if (File.Exists(Path.Combine(path, "Remove.txt")))
			{
				using (StreamReader streamReader = new StreamReader("Remove.txt"))
				{
					string text = streamReader.ReadToEnd();
					text = text.Trim();
					try
					{
						File.Delete($"ExamenV{text}.exe");
					}
					catch
					{
					}
					try
					{
						File.Delete($"ExamenV{text}.exe.config");
					}
					catch
					{
					}
				}
				File.Delete("Remove.txt");
			}
			if (Directory.Exists(Path.Combine(path, $"ExamenV{current}")))
			{
				try
				{
					Directory.Delete(Path.Combine(path, $"ExamenV{current}"), recursive: true);
				}
				catch
				{
				}
			}
			if (File.Exists(Path.Combine(path, $"ExamenV{current}.zip")))
			{
				try
				{
					File.Delete($"ExamenV{current}.zip");
					return;
				}
				catch
				{
					return;
				}
			}
		}
		catch (Exception)
		{
			throw;
		}
	}
}
