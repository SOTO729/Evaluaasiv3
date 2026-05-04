using System;
using System.Data;
using System.Xml.Serialization;

namespace CulturaDigital.Models;

[Serializable]
public class Aplicacion
{
	[XmlAttribute("AppId")]
	public int AppId { get; set; }

	[XmlAttribute("Prioritaria")]
	public int Prioritaria { get; set; }

	[XmlAttribute("VersionExe")]
	public string VersionExe { get; set; }

	[XmlAttribute("URL")]
	public string URL { get; set; }

	[XmlAttribute("VersionApp")]
	public string VersionApp { get; set; }

	public Aplicacion()
	{
	}

	public Aplicacion(int _AppId, int _Prioritaria, string _VersionExe, string _URL, string _VersionApp)
	{
		AppId = _AppId;
		Prioritaria = _Prioritaria;
		VersionExe = _VersionExe;
		URL = _URL;
		VersionApp = _VersionApp;
	}

	public Aplicacion(DataRow dr, string ProductVersion)
	{
		AppId = int.Parse(dr[5].ToString());
		Prioritaria = int.Parse(dr[6].ToString());
		URL = dr[7].ToString();
		VersionApp = "";
		VersionExe = ProductVersion;
	}
}
