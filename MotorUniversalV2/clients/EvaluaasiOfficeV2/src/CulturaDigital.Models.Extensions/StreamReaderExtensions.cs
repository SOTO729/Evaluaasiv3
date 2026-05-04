using System;
using System.IO;

namespace CulturaDigital.Models.Extensions;

public static class StreamReaderExtensions
{
	public static string[] GetContenidoTXT(this StreamReader stream)
	{
		string[] array = stream.ReadToEnd().Split(new string[1] { Environment.NewLine }, StringSplitOptions.None);
		_ = new string[array.Length];
		Array.Reverse(array);
		return array;
	}
}
