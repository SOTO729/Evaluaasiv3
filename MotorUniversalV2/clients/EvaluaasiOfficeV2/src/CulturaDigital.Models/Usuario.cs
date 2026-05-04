using System;
using System.Collections.Generic;
using System.Data;
using System.Xml.Serialization;

namespace CulturaDigital.Models;

[Serializable]
public class Usuario
{
	[XmlAttribute("UsuarioId")]
	public int UsuarioId { get; set; }

	[XmlAttribute("UsuarioNombre")]
	public string UsuarioNombre { get; set; }

	[XmlAttribute("PerfilId")]
	public int PerfilId { get; set; }

	[XmlAttribute("SubSistemaId")]
	public int SubSistemaId { get; set; }

	[XmlAttribute("PlantelId")]
	public int PlantelId { get; set; }

	[XmlAttribute("GrupoId")]
	public int GrupoId { get; set; }

	[XmlAttribute("Perfil")]
	public string Perfil { get; set; }

	[XmlAttribute("SubSistema")]
	public string SubSistema { get; set; }

	[XmlAttribute("Plantel")]
	public string Plantel { get; set; }

	[XmlAttribute("Grupo")]
	public string Grupo { get; set; }

	[XmlAttribute("Nombre")]
	public string Nombre { get; set; }

	[XmlAttribute("Apellido")]
	public string Apellido { get; set; }

	[XmlAttribute("Password")]
	public string Password { get; set; }

	[XmlAttribute("Aviso")]
	public int Aviso { get; set; }

	[XmlAttribute("MostrarAviso")]
	public int MostrarAviso { get; set; }

	[XmlAttribute("UsuarioEmail")]
	public string UsuarioEmail { get; set; }

	[XmlAttribute("CURP")]
	public string CURP { get; set; }

	[XmlAttribute("PinSeguridad")]
	public bool PinSeguridad { get; set; }

	[XmlAttribute("PIN")]
	public string PIN { get; set; }

	public List<Voucher> Acreditaciones { get; set; }

	public Usuario()
	{
	}

	public Usuario(DataRow dr)
	{
		Voucher voucher = new Voucher();
		UsuarioId = int.Parse(dr[0].ToString());
		Nombre = dr[1].ToString();
		Apellido = dr[2].ToString();
		Acreditaciones = new List<Voucher>();
		SubSistema = dr[10].ToString();
		PerfilId = int.Parse(dr[12].ToString());
		Plantel = dr[13].ToString();
		Grupo = dr[14].ToString();
		UsuarioEmail = dr[15].ToString();
		MostrarAviso = int.Parse(dr[16].ToString());
		Aviso = int.Parse(dr[17].ToString());
		CURP = dr[18].ToString();
		SubSistemaId = int.Parse(dr[19].ToString());
		Perfil = dr[20].ToString();
		voucher.VoucherId = int.Parse(dr[3].ToString());
		voucher.VoucherCode = dr[4].ToString();
		voucher.AplicacionId = int.Parse(dr[5].ToString());
		if (!string.IsNullOrEmpty(voucher.VoucherCode))
		{
			voucher.NoOportunidad = int.Parse(voucher.VoucherCode.Substring(8, 1));
		}
		voucher.UsuarioId = int.Parse(dr[0].ToString());
		Acreditaciones.Add(voucher);
		PinSeguridad = bool.Parse(dr[23].ToString());
		PIN = dr[24].ToString();
	}
}
