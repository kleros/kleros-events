// Advance widths in 1/1000 em, two base-36 digits per glyph, in the order of GLYPHS. Measured from the TTFs in
// ./fonts (Chrome canvas measureText at 1000px), so type can be fitted with no DOM, the same way on the server,
// in the browser and in satori. Regenerate them if a font file changes.

/** Printable ASCII, Latin-1, Latin Extended-A, quotes, en dash, middle dot, ellipsis. Anything else counts as 0.5 em. */
export const GLYPHS = " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿĀāĂăĄąĆćĈĉĊċČčĎďĐđĒēĔĕĖėĘęĚěĜĝĞğĠġĢģĤĥĦħĨĩĪīĬĭĮįİıĲĳĴĵĶķĸĹĺĻļĽľĿŀŁłŃńŅņŇňŉŊŋŌōŎŏŐőŒœŔŕŖŗŘřŚśŜŝŞşŠšŢţŤťŦŧŨũŪūŬŭŮůŰűŲųŴŵŶŷŸŹźŻżŽžſ’‘“”–·…";

/** Instrument Serif Regular: the event name in the share image. */
export const SERIF = "4q6labhnblgeg36h9g9gccer61by5x76cs6xb8abaxamb8a4c1b65x61ererer8ticcpdadceqclbcehf66x6xdsbhihf0f0cyf0e9bbctewcpi3f6d9bv917691c1ag9ub3cb9fcp9v80b6d2675zcj64jkd2bcccca8u8k77cmaxglapb59t8u708uercpcpcpcpcpcplmdcclclclcl6x6x6x6xeqf0f0f0f0f0f0erf0ewewewewd9cycbb3b3b3b3b3b3fx9f9v9v9v9v67676767b8d2bcbcbcbcbcerbccmcmcmcmb5ccb5cpb3cpb3cpb3dc9fdc9fdc9fdc9feqeceqcpcl9vcl9vcl9vcl9vcl9vehb6ehb6ehb6ehb6f6d2f6d26x676x676x676x676x67duc66x5zdscjdwbh64bh64bh7zgz9kbh7rf0d2f0d2f0d2gsf0csf0bcf0bcf0bckxhre98ue98ue98ubb8kbb8kbb8kbb8kct77ct77gz7qewcmewcmewcmewcmewcmewcmi3gld9b5d9bv9tbv9tbv9t7q4m4m8s8se62xet";
