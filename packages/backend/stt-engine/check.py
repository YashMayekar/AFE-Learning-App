import onnx
m = onnx.load("SraVaani-live-0.5-onnx-export-v2/latency_80ms/model.onnx")
# print("INPUTS:", [i.name for i in m.graph.input])
# print("OUTPUTS:", [o.name for o in m.graph.output])
# print("METADATA:", {p.key: p.value for p in m.metadata_props})
for i in m.graph.input:
    if i.name == "audio_signal":
        print([d.dim_value or d.dim_param for d in i.type.tensor_type.shape.dim])