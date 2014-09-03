$(document).ready(function() {



    Test = Unit (
        function () {
            console.log("Test");
        }, "Test Unit");




    m = new Module(function(){





        this.Unit (
            function (inA1, inB1) {
                this.yield({
                    "outA1": inA1 + inB1,
                    "outB1": 3
                });
            }, "Unit m1")
            .connect({
                "inA1": "w1",
            }, "level")
            .connect({
                "inB1": "w2",
                "outA1": "w3",
                "outB1": "w4"
            });



        this.Unit (
            function (inA2, inB2) {
                this.yield({
                    "outA2": inA2 - inB2,
                    "outB2": 33
                });
            }, "Unit m2")
            .connect({
                "inA2": "w3",
                "inB2": "w4",
                "outA2": "w5",
                "outB2": "w6"
            });


        this.Unit (
            function (inC) {
                console.log(inC);
                //throw Error("qaaa");
            }, "Unit m3")
            .connect({"inC": "w5"});



        this.Unit(Test);

        this.Unit (
            function () {
                console.log("Test");
            }, "Test Unit");




        this.Storage({
            "store": {
                "w3": "data1",
                "w5": "data2"
            },
            "log": {
                "w1": "data3"
            }
        });


        this.bus.newWire("w21");
        this.bus.w21.module = this;
        this.bus.newWire("w22");
        this.bus.w22.module = this;

        this.Module(function(){
            this.Unit(function(p1, p2){
                this.yield({"p3": p2, "p4": p1});

            }, "Test Unit 2")
            .connect({"p1": "p1", "p2": "p2", "p3": "p3"})
            .connect({"p4": "p4"}, "level");

        }, "Test Module")
        .connect({"p3": "w2", "p4": "w1", "p2": "w1", "p1": "w21", "p2": "w22"});



    }, "Main module");
        
});

