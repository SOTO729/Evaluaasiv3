using System;
using System.Xml.Serialization;

namespace CulturaDigital.Models;

[Serializable]
public class Voucher
{
	[XmlAttribute("VoucherId")]
	public int VoucherId { get; set; }

	[XmlAttribute("VoucherCode")]
	public string VoucherCode { get; set; }

	[XmlAttribute("NoOportunidad")]
	public int NoOportunidad { get; set; }

	[XmlAttribute("UsuarioId")]
	public int UsuarioId { get; set; }

	[XmlAttribute("AplicacionId")]
	public int AplicacionId { get; set; }

	public int Resultado { get; set; }

	public Voucher()
	{
	}

	public Voucher(int _VoucherId, string _VoucherCode, int _NoOportunidades, int _UsuarioId, int _AplicacionId)
	{
		VoucherId = _VoucherId;
		VoucherCode = _VoucherCode;
		NoOportunidad = _NoOportunidades;
		UsuarioId = _UsuarioId;
		AplicacionId = _AplicacionId;
	}
}
