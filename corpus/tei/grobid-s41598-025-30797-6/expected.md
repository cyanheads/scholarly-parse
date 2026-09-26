# Advanced soliton structures and elliptic wave patterns in a sixthorder nonlinear Schrödinger equation using improved modified extended tanh function method

Mina M Fahim, Hamdy M 2, Ahmed, K A Dib, Islam Samir  
DOI: 10.1038/s41598-025-30797-6

## Abstract

In this work, a sixth-order extension of the nonlinear Schrödinger equation (NLSE) within its integrable hierarchy is investigated to model higher-order nonlinear and dispersive effects relevant to optical fiber systems and nonlinear wave propagation. By employing the Improved Modified Extended Tanh Function Method, a comprehensive family of exact analytical solutions is derived, encompassing bright and dark solitons, singular soliton structures, and singular periodic solutions. In addition, solution families expressed in terms of Jacobi elliptic functions, Weierstrass doubly periodic elliptic functions, and exponential profiles are obtained. The novelty of this study lies in extending the analytical framework of the NLSE hierarchy to its sixth-order integrable form and in uncovering new soliton and elliptic wave structures. The obtained results reveal rich nonlinear dynamics associated with higherorder dispersion and nonlinearity and clarify the transition between periodic and localized behaviors. Two-and three-dimensional graphical simulations further illustrate the spatiotemporal evolution of the derived solutions. Overall, the findings deepen the understanding of advanced nonlinear wave mechanisms and offer potential implications for ultrafast optical and nonlinear waveguide systems.

nonlinear matter waves in Bose-Einstein condensates, and intense Langmuir wave packets in plasma require the inclusion of higher-order dispersive and nonlinear effects 9 . In fiber optics, for example, third-order dispersion and self-steepening become significant for picosecond pulses, while fourth-and sixth-order dispersion terms become relevant for femtosecond pulses propagating in photonic-crystal fibers, dispersion-engineered fibers, and microstructured waveguides. These higher-order contributions also capture delayed nonlinear responses, Raman-type effects, and ultrafast saturation of the Kerr nonlinearity.

The hierarchical extension of the NLSE, often referred to as the generalized nonlinear Schrödinger hierarchy, has been developed to characterize systems that require successive higher-order corrections while preserving integrability [10][11][12] . In this work, we focus on the sixth-order member of this hierarchy, given by

iψx + 1 2 ψtt + ψ|ψ| 2 -iα3 ( ψttt + 6|ψ| 2 ψt ) + α4 ( ψtttt + 8|ψ| 2 ψtt + 6ψ|ψ| 4 + 4ψ|ψt| 2 + 6ψ 2 t ψ \* + 2ψ 2 ψ \* tt ) + iα5 ( ψttttt + 10|ψ| 2 ψttt + 30|ψ| 4 ψt + 10ψψtψ \* tt + 10ψψ \* t ψtt + 20ψ \* ψtψtt + 10ψ 2 t ψ \* t ) + α6ψtttttt + α6 [ 60ψ \* |ψt| 2 + 50(ψ \* ) 2 ψtt + 2ψ \* tttt ] ψ 2 + α6ψ [ 12ψ \* ψtttt + 8ψtψ \* ttt + 22|ψtt| 2 ] + α6ψ [ 18ψtttψ \* t + 70(ψ \* ) 2 ψ 2 t ] + 20α6ψ 2 t ψ \* tt + 10α6ψt [5ψttψ \* t + 3ψ \* ψttt] + 20α6ψ \* ψ 2 tt + 10α6ψ 3 [ (ψ \* t ) 2 + 2ψ \* ψ \* tt ] + 20α6ψ|ψ| 6 = 0.

(

This equation generalizes well-known integrable NLSE-type models. Specifically, setting α5 = α6 = 0 yields the LPD equation 3 , while α4 = α5 = α6 = 0, recovers the Hirota equation 10 . Despite the theoretical significance of the sixth-order extension, systematic analytical studies and explicit solution constructions for this model remain scarce in the literature. This motivates the present investigation. From a physical perspective, the coefficients α3, α4, α5, and α6 represent progressively higher-order dispersive and nonlinear contributions : α3, and α4 is associated with third, and fourth-order dispersion, nonlinear dispersion, and self-frequency shift effects; α5 governs fifth-order nonlinear dispersion and ultrafast self-steepening interactions; and α6 corresponds to sixth-order dispersion and high-order nonlinear responses, which become significant in the propagation of ultrashort pulses where higher-order spectral broadening and nonlinear refractive index saturation occur. Such effects are particularly relevant in the design of high-power fiber lasers, super continuum generation in photonic-crystal fibers, and the manipulation of matter-wave solitons in condensates subjected to higher-order effective interactions.

Recently, many researchers have been actively modifying and applying various ansatz-based methods and analytical techniques to obtain soliton solutions. Among the commonly used methods are the Fan sub-equation method 13 , the extended simplest equation method 14 , the new extended auxiliary equation method 15,16 , the solitary wave ansatz method 17 , the Sardar sub-equation method 18 , the modified extended direct algebraic method [19][20][21] , the improved modified extended tanh function method [22][23][24] , and the Jacobi elliptic function method 25 , as well as the F-expansion method 26 . In addition, other effective approaches such as the sine-Gordon method 27 , the Hirota bilinear method [28][29][30] , and the exp(ϕ(ζ))-function method 31 have also been employed to derive analytical soliton solutions.

Several researchers have investigated the stability of soliton solutions using analytical and numerical methods to better understand their dynamical behavior 32,33 . These studies provide insight into the robustness and persistence of solitons under perturbations in nonlinear systems.

Motivation and research gap. Higher-order NLSE hierarchies are essential for understanding ultrashort pulse propagation and strong nonlinear wave interactions. However, analytical results for the sixth-order NLSE member remain limited. In particular, explicit soliton and periodic solutions, along with their physical characteristics, have not been sufficiently reported. Elucidating the structure of such higher-order solitary waves provides deeper insight into pulse-shaping mechanisms and nonlinear dispersion balances in advanced optical and quantum systems.

Objective. The main objective of this work is to derive exact closed-form solutions for the sixth-order NLSE hierarchy and analyze the corresponding nonlinear wave structures.

## Method and contributions.

To achieve this, we utilize the improved modified extended tanh function method, a powerful symbolic technique for solving nonlinear evolution equations. The major contributions are summarized as follows:

• Analytical investigation of the sixth-order NLSE hierarchy and its physical relevance.

• Construction of new exact solutions, including bright, dark, and singular solitons.

• Derivation of additional periodic solutions expressed in terms of Jacobi and Weierstrass elliptic functions.

• Numerical visualization of selected solutions in 2D and 3D to illustrate propagation dynamics.

## Proposed technique

We briefly outline the steps involved in the improved modified extended tanh function method (IMETFM) [22][23][24] .

First, we assume that the nonlinear partial differential equation can be expressed in terms of ψ and its partial derivatives as follows: P(ψ, ψt, ψx, ψxt, ψxx, . . .) = 0.

(

To reduce Eq. ( 2), we assume a traveling wave transformation for the wave envelope

ψ(x, t) = ψ(ζ),

where ζ = x -νt with ν ̸ = 0, which converts the function ψ into a function of a single-variable form. Substituting this transformation into Eq. ( 2) yields the following ordinary differential equation: P(ψ, ψ (1) , ψ (2) , ψ (3) , ψ (4) , . . .) = 0.

(

The next step in applying the IMETFM is to assume that the solution of Eq. ( 3) has the finite series form

ψ(ζ) = N ∑ i=-N ciϕ i (ζ), (4)

where c 2 N + c 2 -N ̸ = 0, and the function ϕ satisfies the extended Riccati equation

ϕ ′ = √ d0 + d1ϕ + d2ϕ 2 + d3ϕ 3 + d4ϕ 4 . ( (5)

)

The integer N is determined by applying the homogeneous balance principle, which balances the highest-order derivative term with the highest-order nonlinear term in Eq. ( 3). Substituting Eq. ( 4) into Eq. ( 3), while taking Eq. ( 5) into account, results in a polynomial in ϕ. By equating the coefficients of the obtained polynomial in ϕ to zero, we obtain a system of nonlinear algebraic equations involving the parameters of the original equation, the Riccati equation, and the finite series form. This system can be solved using symbolic computation software such as Mathematica.

## Methodology and findings

We now apply the improved modified extended tanh function method to Eq.( 1). Assuming the wave envelope as:

ψ(x, t) = R(ζ)e i(ωt-kx+θ) , (6)

where ζ = x -νt, and ν, θ, k, ω, represent the soliton speed, phase constant, wave number, and soliton frequency, respectively. Inserting the wave envelope assumption in Eq. ( 6) into Eq. ( 1), then splitting the obtained equation into its real,and imaginary components, then we get the following:

The real component is given by:

R ( -2α6ω 6 + 2α5ω 5 + 2α4ω 4 -2α3ω 3 + 2k -ω 2 ) + R 3 ( 60α6ω 4 -40α5ω 3 -24α4ω 2 + 12α3ω + 2 ) + R ( R ′ ) 2 ( -300α6ν 2 ω 2 + 100α5ν 2 ω + 20α4ν 2 ) + 40α6R 7 + R 5 ( -180α6ω 2 + 60α5ω + 12α4 ) + 280α6ν 2 R 3 ( R ′ ) 2 + R ′′ ( 30α6ν 2 ω 4 -20α5ν 2 ω 3 -12α4ν 2 ω 2 + 6α3ν 2 ω + ν 2 ) + 84α6ν 4 R ( R ′′ ) 2 + 112α6ν 4 RR (3) R ′ + 140α6ν 4 ( R ′ ) 2 R ′′ + R 2 R ′′ ( -300α6ν 2 ω 2 + 100α5ν 2 ω + 20α4ν 2 ) + 140α6ν 2 R 4 R ′′ + 2α6ν 6 R (6) + R (4) ( -30α6ν 4 ω 2 + 10α5ν 4 ω + 2α4ν 4 ) + 28α6ν 4 R 2 R (4) = 0.

The imaginary component reads:

( -12α6νω 5 + 10α5νω 4 + 8α4νω 3 -6α3νω 2 -2νω + 2 ) R ′ + ( 240α6νω 3 -120α5νω 2 -48α4νω + 12α3ν ) R 2 R ′ + ( 20α5ν 3 -120α6ν 3 ω ) R ′3 + ( 80α5ν 3 -480α6ν 3 ω ) RR ′ R ′′ + (60α5ν -360α6νω) R 4 R ′ + ( 2α5ν 5 -12α6ν 5 ω ) R (5) + ( 40α6ν 3 ω 3 -20α5ν 3 ω 2 -8α4ν 3 ω + 2α3ν 3 ) R (3) + ( 20α5ν 3 -120α6ν 3 ω ) R (3) R 2 = 0.

Equating the coefficients of the imaginary parts to zero, we derive the following relationships:

             ν = 1250α 3 5 216α 4 4 + 810α3α5α 2 4 -72α 3 4 L -15α5α4 (25α5 + 14α3L) + 25α 2 5 (18α 2 3 + 5L) , ω = L -3α 4 10α5 , α6 = α5(L + 3α4) 9α3 ,

where L = √ 9α 2 4 + 15α3α5. Applying the balancing principle by balancing the highest order derivative term R (6) with the highest nonlinear term R 7 in the real part, we obtain that N = 1. Consequently, we express R(ζ) as:

R(ζ) = c0 + c1ϕ + c-1ϕ -1 . ( (7)

)

Substituting Eq. ( 7) into the real part and considering the extended Riccati equation in Eq. ( 5), we obtain a polynomial in ϕ. By equating the coefficients of this polynomial to zero, we derive different algebraic systems based on the values of d0, d1, d2, d3, d4, which are then solved using Mathematica.

## Localized solitons

When {d0 = d1 = d3 = 0}, we attain the following result.

         c1 = √ -d4 ν, c0 = c-1 = 0, k = 1 2 [ ω 2 -2ν 6 d 3 2 α6 + 2ω 3 ( α3 -ω(α4 + ωα5) + ω 3 α6 ) -ν 2 d2 ( 1 + 6ωα3 -4ω 2 (3α4 + 5ωα5) + 30ω 4 α6 ) -2ν 4 d 2 2 ( α4 + 5ω(α5 -3ωα6) ) ] .

Then, the preceding solution set admits the following bright soliton.

ψ(x, t) = 1250α 3 5 √ d2sech (√ d2ζ

)

× e i(θ-kx+tω) 216α 4 4 -72Lα 3 4 + 810α3α5α 2 4 -15α5 (14Lα3 + 25α5) α4 + 25 (18α 2 3 + 5L) α 2 5 , ( (8)

)

When {d1 = d3 = 0, d0 = d 2 2 4d

4 }, we attain the following result.

         c1 = √ -d4 ν, c0 = c-1 = 0, k = 1 2 ( -5ν 6 d 3 2 α6 -3ν 4 d 2 2 ( α4 + 5ω(α5 -3ωα6)

)

\+ ω 2 ( 1 + 2ω(α3 -ω(α4 + ωα5) + ω 3 α6) ) + ν 2 d2 ( -1 -6ωα3 + 2ω 2 (6α4 + 5ω(2α5 -3ωα6))

) )

.

Then, We get the following dark soliton.

ψ(x, t) = 625 √ 2α 3 5 √ d2 tanh ( √ -d 2 ζ √ 2

)

× e i(θ-kx+tω) 216α 4 4 -72Lα 3 4 + 810α3α5α 2 4 -15α5 (14Lα3 + 25α5) α4 + 25 (18α 2 3 + 5L) α 2 5 , ( (9)

)

When {d0 = d1 = 0, d2 = d 2 3

4d 4 }, we get the following result. 6 3 ν 6 -24d4d 4 3 ν 4 (5ω(α5 -3α6ω) + α4)

                 c0 = id3ν 4 √ d4 , c1 = i √ d4 ν, c-1 = 0, k = 1 1024d 3 4 [ 5α6d

\+ 64d 2 4 d 2 3 ν 2 ( 30α6ω 4 -4ω 2 (5α5ω + 3α4) + 6α3ω + 1 ) + 512d 3 4 ω 2 ( 2ω(α6ω 3 -ω(α5ω + α4) + α3) + 1 ) ] .

Then, the preceding result yields the following dark soliton.

ψ(x, t) = - 625iα 3 5 ( 2 √ d2d4 ( tanh ( √ d 2 ζ 2 ) + 1 ) + d3

)

× e i(θ-kx+tω) 2 √ d4 (-216α 4 4 -810α3α5α 2 4 + 72α 3 4 L + 15α5α4 (25α5 + 14α3L) -25α 2 5 (18α 2 3 + 5L)) . ( (10)

)

## Singular periodic solutions and singular solitons

When {d3 = d4 = d1 = 0}, we get the following solution set :

         c0 = c1 = 0, c-1 = √ -d0 ν, k = 1 2 [ 2ω 3 ( α6ω 3 -ω(α5ω + α4) + α3 ) -2α6d 3 2 ν 6 -2d 2 2 ν 4 (5ω(α5 -3α6ω) + α4) -d2ν 2 ( 30α6ω 4 -4ω 2 (5α5ω + 3α4) + 6α3ω + 1 ) + ω 2 ] .

Consequently, we obtain the following singular periodic solution and singular soliton, respectively.

ψ(x, t) = 1250α 3 5 √ d2 csc (√ -d2ζ

)

× e i(θ-kx+tω) 216α 4 4 + 810α3α5α 2 4 -72α 3 4 L -15α5α4 (25α5 + 14α3L) + 25α 2 5 (18α 2 3 + 5L) , ( (11)

) ψ(x, t) = 1250α 3 5 √ -d2csch (√ -d2ζ

)

× e i(θ-kx+tω) 216α 4 4 + 810α3α5α 2 4 -72α 3 4 L -15α5α4 (25α5 + 14α3L) + 25α 2 5 (18α 2 3 + 5L) . ( (12)

)

When {d1 = d3 = 0, d0 = d 2 Result 1            c-1 = id2ν 2 √ d4 , c0 = c1 = 0, k = 1 2 [ -5ν 6 d 3 2 α6 -3ν 4 d 2 2 (α4 + 5ω(α5 -3ωα6)) + ω 2 ( 1 + 2ω(α3 -ω(α4 + ωα5) + ω 3 α6) ) + ν 2 d2 ( -1 -6ωα3 + 2ω 2 (6α4 + 5ω(2α5 -3ωα6)) ) ] .

Consequently, the previous result admits the following singular periodic solution, and singular soliton, respectively.

ψ(x, t) = 625i √ 2α 3 5 d2 cot ( √ d 2 ζ √ 2

)

× e i(θ-kx+tω) √ d2 (216α 4 4 + 810α3α5α 2 4 -72α 3 4 L -15α5α4 (25α5 + 14α3L) + 25α 2 5 (18α 2 3 + 5L)) , ( (13)

) ψ(x, t) = 625 √ 2α 3 5 d2 coth ( √ -d 2 ζ √ 2

)

× e i(θ-kx+tω) √ d2 (216α 4 4 + 810α3α5α 2 4 -72α 3 4 L -15α5α4 (25α5 + 14α3L) + 25α 2 5 (18α 2 3 + 5L)) . ( (14)

)

Result 2            c0 = 0, c1 = i √ d4 ν, c-1 = id2ν 2 √ d4 , k = 1 2 [ -5ν 6 d 3 2 α6 -3ν 4 d 2 2 ( α4 + 5ω(α5 -3ωα6) ) + ω 2 ( 1 + 2ω(α3 -ω(α4 + ωα5) + ω 3 α6) ) + ν 2 d2 ( -1 -6ωα3 + 2ω 2 (6α4 + 5ω(2α5 -3ωα6)) ) ] .

Then, we associate with the preceding solution set, the following singular soliton, and singular periodic solution, respectively.

ψ(x, t) = 1250 √ 2α 3 5 √ d2csch (√ 2 √ -d2ζ

)

× e i(θ-kx+tω) -216α 4 4 -810α3α5α 2 4 + 72α 3 4 L + 15α5α4 (25α5 + 14α3L) -25α 2 5 (18α 2 3 + 5L) , ( (15)

) ψ(x, t) = 1250i √ 2α 3 5 √ d2 csc (√ 2 √ d2ζ

)

× e i(θ-kx+tω) 216α 4 4 + 810α3α5α 2 4 -72α 3 4 L -15α5α4 (25α5 + 14α3L) + 25α 2 5 (18α 2 3 + 5L) . ( (16)

)

When {d0 = d1 = d3 = 0}, we attain the following result.

         c1 = √ -d4 ν, c0 = c-1 = 0, k = 1 2 [ ω 2 -2ν 6 d 3 2 α6 + 2ω 3 ( α3 -ω(α4 + ωα5) + ω 3 α6 ) -ν 2 d2 ( 1 + 6ωα3 -4ω 2 (3α4 + 5ωα5) + 30ω 4 α6 ) -2ν 4 d 2 2 ( α4 + 5ω(α5 -3ωα6) ) ] .

Then, the following singular periodic solution is obtained

ψ(x, t) = 1250α 3 5 √ d2 sec (√ -d2ζ

)

× e i(θ-kx+tω) 216α 4 4 + 810α3α5α 2 4 -72α 3 4 L -15α5α4 (25α5 + 14α3L) + 25α 2 5 (18α 2 3 + 5L) . ( (17)

)

When {d1 = d3 = 0, d0 = d 2 2 4d 4 }, the following result is obtained.          c1 = √ -d4 ν, c0 = c-1 = 0, k = 1 2 ( -5ν 6 d 3 2 α6 -3ν 4 d 2 2 ( α4 + 5ω(α5 -3ωα6) ) + ω 2 ( 1 + 2ω(α3 -ω(α4 + ωα5) + ω 3 α6) ) + ν 2 d2 ( -1 -6ωα3 + 2ω 2 (6α4 + 5ω(2α5 -3ωα6))

) )

.

Then, the latter admits the following singular periodic solution.

ψ(x, t) = 625 √ 2α 3 5 √ -d2 tan ( √ d 2 ζ √ 2

)

×

e i(θ-kx+tω) 216α 4 4 -72Lα 3 4 + 810α3α5α 2 4 -15α5 (14Lα3 + 25α5) α4 + 25 (18α 2 3 + 5L) α 2 5 Jacobi elliptic functions and weierstrass solution

When {d1 = d3 = 0, d0 = d 2 2 m 2 (1-m 2 ) d 4( 2m 2 -1)

2 }, we get the following results.

Result 1            c1 = √ -d4 ν, c0 = c-1 = 0, k = ω 3 ( α6ω 3 -ω(α5ω + α4) + α3 ) - 1 2 d2ν 2 ( 30α6ω 4 -4ω 2 (5α5ω + 3α4) + 6α3ω + 1 ) + α 6d 3 2 (2m 4 -2m 2 -1)ν 6 (1 -2m 2 ) 2 - d 2 2 (2m 4 -2m 2 + 1)ν 4 [5ω(α5 -3α6ω) + α4] (1 -2m 2 ) 2 + ω 2 2 ,

which admits the following Jacobi elliptic function solution.

ψ(x, t) = 1250α (3)

5 d 2 m 2 2m 2 -1 cn ζ d 2 2m 2 -1 m × e i(θ-kx+tω) 216α 4 4 + 810α3α5α 2 4 -72α 3 4 L -15α5α4 (25α5 + 14α3L) + 25α 2 5 (18α 2 3 + 5L) . ( (19)

)

Result 2              c1 = c0 = 0, c-1 = id2m √ m 2 -1 ν √ -4d4m 4 + 4d4m 2 -d4 , k = ω 3 ( α6ω 3 -ω(α5ω + α4) + α3 ) - 1 2 d2ν 2 ( 30α6ω 4 -4ω 2 (5α5ω + 3α4) + 6α3ω + 1 ) + α 6d 3 2 (2m 4 -2m 2 -1)ν 6 (1 -2m 2 ) 2 - d 2 2 (2m 4 -2m 2 + 1)ν 4 [5ω(α5 -3α6ω) + α4] (1 -2m 2 ) 2 + ω 2 2 ,

which admits another Jacobi elliptic solution.

ψ(x, t) = 1250α 3 5 d2 √ 1 -m 2 cn ζ d2 2m 2 -1 m -1 × e i(θ-kx+tω) d2 (2m 2 -1) (216α 4 4 + 810α3α5α 2 4 -72α 3 4 L -15α5α4 (25α5 + 14α3L) + 25α 2 5 (18α 2 3 + 5L)) . ( (20)

)

When {d1 = d3 = 0, d0 = d 2 2 (1-m 2 ) d 4( 2-m 2 ) 2 }, we get the following results.

Result 1            c0 = c-1 = 0, c1 = √ -d4 ν, k = 1 2 [ - 2(10 -10m 2 + m 4 ) ν 6 d 3 2 α6 (-2 + m 2 ) 2 - 2(6 -6m 2 + m 4 ) ν 4 d 2 2 (α4 + 5ω(α5 -3ωα6)) (-2 + m 2 ) 2 + ω 2 ( 1 + 2ω(α3 -ω(α4 + ωα5) + ω 3 α6) ) + ν 2 d2 ( -1 -6ωα3 + 2ω 2 (6α4 + 5ω(2α5 -3ωα6)) ) ] .

Then, we obtain the following Jacobi elliptic function solution.

ψ(x, t) = 1250α 3 5 m 2 2-m 2 dn ζ d 2 2-m 2 m × e i(θ-kx+tω) 216α 4 4 + 810α3α5α 2 4 -72α 3 4 L -15α5α4 (25α5 + 14α3L) + 25α 2 5 (18α 2 3 + 5L) . ( (21)

)

Result 2              c1 = c0 = 0, c-1 = id2m √ m 2 -1 ν √ -4d4m 4 + 4d4m 2 -d4 , k = 1 2 [ - 2(10 -10m 2 + m 4 ) ν 6 d 3 2 α6 (-2 + m 2 ) 2 - 2(6 -6m 2 + m 4 ) ν 4 d 2 2 (α4 + 5ω(α5 -3ωα6)) (-2 + m 2 ) 2 + ω 2 ( 1 + 2ω(α3 -ω(α4 + ωα5) + ω 3 α6) ) + ν 2 d2 ( -1 -6ωα3 + 2ω 2 (6α4 + 5ω(2α5 -3ωα6)) ) ]

, which admits another Jacobi elliptic function solution. ψ(x, t) = 1250α 3 5 d2

√ 1 -m 2 dn ζ d 2 2-m 2 m -1 × e i(θ-kx+tω) m √ 2 -m 2 (216α

4 4 + 810α3α5α 2 4 -72α 3 4 L -15α5α4 (25α5 + 14α3L) + 25α 2 5 (18α 2 3 + 5L)) . (22) Scientific Reports | (2025) 15:43949

When {d1 = d3 = 0, d0 = d 2 2 m 2 d 4( m 2 +1)

2 }, we get the following results.

Result 1            c0 = c-1 = 0, c1 = √ -d4 ν, k = 1 2 [ - 2(1 + 8m 2 + m 4 ) ν 6 d 3 2 α6 (1 + m 2 ) 2 - 2(1 + 4m 2 + m 4 ) ν 4 d 2 2 (α4 + 5ω(α5 -3ωα6)) (1 + m 2 ) 2 + ω 2 ( 1 + 2ω(α3 -ω(α4 + ωα5) + ω 3 α6) ) + ν 2 d2 ( -1 -6ωα3 + 2ω 2 (6α4 + 5ω(2α5 -3ωα6))

) ] , which reads the following Jacobi elliptic solution.

ψ(x, t) = 1250α 3 5 d 2 m 2 m 2 +1 sn ζ -d 2 m 2 +1 m × e i(θ-kx+tω) 216α 4 4 + 810α3α5α 2 4 -72α 3 4 L -15α5α4 (25α5 + 14α3L) + 25α 2 5 (18α 2 3 + 5L) . ( (23)

)

Result 2              c0 = c1 = 0, c-1 = d2mν √ -d4m 4 -2d4m 2 -d4 , k = 1 2 [ - 2(1 + 8m 2 + m 4 ) ν 6 d 3 2 α6 (1 + m 2 ) 2 - 2(1 + 4m 2 + m 4 ) ν 4 d 2 2 (α4 + 5ω(α5 -3ωα6)) (1 + m 2 ) 2 + ω 2 ( 1 + 2ω(α3 -ω(α4 + ωα5) + ω 3 α6) ) + ν 2 d2 ( -1 -6ωα3 + 2ω 2 (6α4 + 5ω(2α5 -3ωα6)) ) ]

, which derive the following Jacobi elliptic solution.

ψ(x, t) = 1250α 3 5 d2sn ζ -d2 m 2 +1 m -1 × e i(θ-kx+tω) d2(m 2 +1) d4 (216α 4 4 + 810α3α5α 2 4 -72α 3 4 L -15α5α4 (25α5 + 14α3L) + 25α 2 5 (18α 2 3 + 5L)) . ( (24)

)

When {d2 = d4 = 0}, the following result is revealed.

                 c-1 = √ -d0 ν, c1 = 0, d3 = 8c 3 0 √ -d0 ν 3 , d1 = - 4c0 √ -d0 ν , k = ω 3 ( α6ω 3 -ω(α5ω + α4) + (α3)

) -3c 2 0 ( 30α6ω 4 -4ω 2 (5α5ω + 3α4) + 6α3ω + 1 ) -46c 4 0 (5ω(α5 -3α6ω) + α4) -396α6c 6 0 + ω 2 2 .

Then, we attain the following Weierstrass elliptic function solution.

ψ(x, t) = ( c0 + 1250iα 3 5 √ d0℘ ( ζ; -4d1 d3 , -4d0 (d3)

) -1 216α 4 4 + 810α3α5α 2 4 -72α 3 4 L -15α5α4 (25α5 + 14α3L) + 25α 2 5 (18α 2 3 + 5L)

)

× e i(θ-kx+tω) . ( (25)

)

## Exponential solution

When {d3 = d4 = 0, d0 = d 2 1 4d 2 } , the following result is obtained.            c1 = 0, c0 = 1 2 i √ d2 ν, c-1 = id1ν 2 √ d2 , k = 1 16 [ 8ω 2 ( 2ω(α6ω 3 -ω(α5ω + α4) + α3) + 1 ) + 5α6d 3 2 ν 6 -6d 2 2 ν 4 (5ω(α5 -3α6ω) + α4) + 4d2ν 2 ( 30α6ω 4 -4ω 2 (5α5ω + 3α4) + 6α3ω + 1 ) ] .

Then, We obtain the following exponential solution.

ψ(x, t) = 625iα 3 5 √ d2 ( (2d2e)

√ d 2 ζ + d1 ) ( (d1 -2d2e)

√ d 2 ζ ) -1 × e i(θ-kx+tω) (216α 4 4 + 810α3α5α 2 4 -72α 3 4 L -15α5α4 (25α5 + 14α3L) + 25α 2 5 (18α 2 3 + 5L))

## Results and discussion

This section presents the dynamical behavior of the obtained solutions for the sixth-order integrable NLSE. Five classes of nonlinear wave structures are examined: bright solitons, dark solitons, singular solitons, singular periodic solutions, and Jacobi elliptic solutions. In the case of the Jacobi elliptic solution, the relation and transition between the periodic and localized (soliton) structures are demonstrated. For each case, both 2D and 3D plots illustrate the evolution of the wave amplitude over space and time, confirming the analytical results.

## Bright soliton dynamics

Figure 1 shows the bright soliton solution defined by Eq. ( 8), represented in both two and three dimensions under identical parameter settings: d2 = 3, α3 = 5, α4 = 2, and α5 = 1, and shown at three different snapshots. Bright solitons retain a localized peak as they propagate, owing to the balance between dispersion and nonlinear self-focusing. The soliton maintains its amplitude and width for all plotted time instances t = 1, 5, 10, demonstrating stable and localized propagation.

## Dark soliton dynamics

Figure 2 displays the dark soliton solution governed by Eq. ( 9), visualized in both two and three dimensions under identical parameter settings: d2 = -1, α3 = 3, α4 = 1.5, and α5 = 1, and in three different time instances. Unlike bright solitons, dark solitons exhibit a localized dip on a continuous background. The structure remains stable for all time levels, reflecting the phase-shifted wave nature observed in defocusing nonlinear media.

## Singular soliton behavior

Figure 3 illustrates the singular soliton solution of Eq. ( 14), visualized in both two and three dimensions under identical parameter settings: d2 = -0.01, α3 = 0.5, α4 = -3, α5 = -1.5, and in three different time instances. Singular solitons represent a special class of nonlinear wave structures characterized by an infinite or extremely large amplitude at specific spatial points. Such solutions often arise in physical systems where 9) visualized in two and three dimensions under identical parameter settings: d2 = -1, α3 = 3, α4 = 1.5, and α5 = 1, and in three different time instances t = 1, 5, 10. 8) visualized in two and three dimensions under identical parameter settings: d2 = 3, α3 = 5, α4 = 2, and α5 = 1, and in three different time instances t = 1, 5, 10.

nonlinear effects dominate over dispersion, leading to energy localization and field blow-up. In applications, singular solitons can model intense wave focusing in optical fibers, plasma collapses, or energy concentration in shallow-water dynamics. Singular solitons develop sharp peaks, indicating points where the amplitude becomes extremely large due to dominant nonlinear amplification. The plots show steep localized gradients, highlighting wave concentration phenomena.

## Singular periodic wave profiles

Figure 4 corresponds to the singular periodic solution of Eq. ( 17), visualized in both two and three dimensions under identical parameter settings: d2 = -2, α3 = -5, α4 = -1, α5 = -2.7, and in three different time instances. These structures periodically develop singular behavior, combining periodic oscillations with sharp amplitude spikes. The plots clearly show repeating localized peaks, indicating strong nonlinear modulation across each period.

## Jacobi elliptic functions and their connection to periodic and soliton solutions

The Jacobi elliptic functions sn(u, m), cn(u, m), and dn(u, m) arise naturally in the analysis of nonlinear evolution equations. Depending on the modulus m (0 ≤ m ≤ 1), they bridge trigonometric and hyperbolic behaviors, thereby linking periodic and soliton solutions. For m → 0, they reduce to trigonometric functions: sn(u, 0) = sin(u), cn(u, 0) = cos(u), dn(u, 0) = 1, while for m → 1, they become hyperbolic: 17) visualized in two and three dimensions under identical parameter settings: d2 = -2, α3 = -5, α4 = -1, α5 = -2.7, and in three different time instances t = 1, 5, 10. 14), visualized in two and three dimensions under identical parameter settings: d2 = -0.01, α3 = 0.5, α4 = -3, α5 = -1.5, and in three different time instances t = 1, 5, 10.

sn(u, 1) = tanh(u), cn(u, 1) = sech(u), dn(u, 1) = sech(u).

Thus, varying the modulus m from 0 to 1 gradually transforms the periodic Jacobi-elliptic waves into solitary structures. Figure 5 illustrates the evolution of the cn(ζ, m) solution in Eq.( 19), showing its transition from singular periodic (arising when the argument becomes complex) to regular periodic and finally to brightsoliton profiles in 3D, under the parameter set d2 = 2, α3 = -3, α4 = 2, and α5 = -1. Figure 6 presents the corresponding 2D profiles for the same parameter values at three representative times t = 1, 5, 10, highlighting the transition from singular periodic to regular periodic and ultimately to bright-soliton behavior.

Overall, the graphical results validate the analytical solutions and demonstrate the complex propagation patterns permitted by the sixth-order NLSE model. The figures highlight the structural evolution, stability characteristics, and nonlinear effects associated with each solution type.

## Conclusion

In this work, we investigated the sixth-order integrable nonlinear Schrödinger equation within its hierarchy and extended the analytical solution landscape of this model. Using the Improved Modified Extended Tanh Function Method (IMETFM), we systematically derived new families of exact solutions, including bright, dark, singular solitons, singular periodic solutions, and Jacobi and Weierstrass elliptic waveforms.

The novelty of this study lies in providing a unified analytical framework for the sixth-order NLSE that captures localized solitons, singular dispersive structures, and doubly-periodic nonlinear waves. The results demonstrate that higher-order dispersion and nonlinear effects significantly enrich the dynamics compared with the classical NLSE, producing additional wave morphologies and amplitude profiles absent in lower-order models.

Two-and three-dimensional graphical simulations illustrate the propagation, intensity localization, and periodic modulation of the solutions, confirming distinct physical signatures, particularly the sharp energy concentration of singular solitons and the smooth periodic patterns of elliptic solutions. 19) is illustrated in 2D, showing the evolution from singular periodic to regular periodic waves and ultimately to a bright soliton as the modulus m → 1, with d2 = 2, α3 = -3, α4 = 2, and α5 = -1, at three representative times t = 1, 5, 10.. 19) is illustrated in 3D, showing the transition from singular periodic to regular periodic waves and finally to a bright soliton as the modulus m → 1, with d2 = 2, α3 = -3, α4 = 2, and α5 = -1.

Physically, higher-order dispersive and nonlinear terms enable a broader range of self-trapped and periodic behaviors. Bright and dark solitons correspond to localized energy packets and intensity depressions, while singular solitons represent ultra-localized energy spikes that can model collapse-like events. Jacobi and Weierstrass elliptic solutions bridge localized and periodic states, showing how continuous modulation of the elliptic modulus transitions the system from periodic oscillations to solitary waves, highlighting the delicate balance between dispersion and nonlinearity.

Overall, these findings underline the physical relevance of the sixth-order NLSE hierarchy and the effectiveness of IMETFM for constructing complex analytical waveforms. Future work may explore stability analysis, perturbation dynamics, and parameter sensitivity.

## Acknowledgements

Not Applicable.

## Funding

Open access funding provided by The Science, Technology & Innovation Funding Authority (STDF) in cooperation with The Egyptian Knowledge Bank (EKB).

## Data availability

The datasets used and/or analyzed during the current study are available from the corresponding author upon reasonable request.

## Competing interests

The authors declare no competing interests.

## Author contributions

Mina M. Fahim: Formal analysis, Software, Methodology; Hamdy M. Ahmed: Validation, Methodology; K. A. Dib: Resources, Writing-review & editing; Islam Samir: Software, Investigation.

## Figures and tables

**Fig. 2 .** Fig. 2. Dark soliton solution for Eq. (9) visualized in two and three dimensions under identical parameter settings: d2 = -1, α3 = 3, α4 = 1.5, and α5 = 1, and in three different time instances t = 1, 5, 10.

**Fig. 1 .** Fig. 1. Bright soliton solution of Eq. (8) visualized in two and three dimensions under identical parameter settings: d2 = 3, α3 = 5, α4 = 2, and α5 = 1, and in three different time instances t = 1, 5, 10.

**Fig. 4 .** Fig. 4. Singular periodic solution for Eq. (17) visualized in two and three dimensions under identical parameter settings: d2 = -2, α3 = -5, α4 = -1, α5 = -2.7, and in three different time instances t = 1, 5, 10.

**Fig. 3 .** Fig. 3. Singular soliton solution for Eq. (14), visualized in two and three dimensions under identical parameter settings: d2 = -0.01, α3 = 0.5, α4 = -3, α5 = -1.5, and in three different time instances t = 1, 5, 10.

**Fig. 6 .** Fig. 6. The Jacobi elliptic function cn(ζ, m) in Eq. (19) is illustrated in 2D, showing the evolution from singular periodic to regular periodic waves and ultimately to a bright soliton as the modulus m → 1, with d2 = 2, α3 = -3, α4 = 2, and α5 = -1, at three representative times t = 1, 5, 10..

**Fig. 5 .** Fig. 5. The Jacobi elliptic function cn(ζ, m) in Eq. (19) is illustrated in 3D, showing the transition from singular periodic to regular periodic waves and finally to a bright soliton as the modulus m → 1, with d2 = 2, α3 = -3, α4 = 2, and α5 = -1.

**Figure.** 30. Mohan, B. & Kumar, S. Generalization and analytic exploration of soliton solutions for nonlinear evolution equations via a novel symbolic approach in fluids and nonlinear sciences. Chin. J. Phys. 92, 10-21 (2024). 31. Mathanaranjan, T. The fractional perturbed nonlinear Schrödinger equation in nanofibers: Soliton solutions and dynamical behaviors. Comput. Model. Fract. Order Syst. 75(8), 155-167 (2024). 32. Mathanaranjan, T., Yesmakhanova, K., Myrzakulov, R. & Naizagarayeva, A. Optical wave structures and stability analysis of integrable Zhanbota equation. Mod. Phys. Lett. B 39(22), 2550071 (2025). 33. Mathanaranjan, T., Tharsana, S. & Dilakshi, G. Solitonic wave structures and stablility analysis for the M-fractional generalized coupled nonlinear Schrödinger-KdV equations. Int. J. Appl. Comput. Math. 10(6), 165 (2024).

## Footnotes

- Scientific Reports | (2025) 15:43949
- \| https://doi.org/10.1038/s41598-025-30797-6
- **2** 4d 4 }, we obtain the following results.Scientific Reports | (2025) 15:43949

## References

- B Mohan, S Kumar, R Kumar. (2025). On investigation of kink-solitons and rogue waves to a new integrable (3+ 1)-dimensional KdVtype generalized equation in nonlinear sciences. *Nonlinear Dyn* 113(9):10261–10276.
- B Mohan, S Kumar. (2024). Rogue-wave structures for a generalized (3+1)-dimensional nonlinear wave equation in liquid with gas bubbles. *Phys. Scr* 99(10):105291.
- B Mohan, S Kumar, R Kumar. (2023). Higher-order rogue waves and dispersive solitons of a novel P-type (3+1)-D evolution equation in soliton theory and nonlinear waves. *Nonlinear Dyn* 111(21):20275–20288.
- A Ankiewicz, M Soto-Crespo, N Akhmediev. (2010). Rogue waves and rational solutions of the Hirota equation. *Phys. Rev. E* 81(4):46602.
- V N Serkin, T L Belyaeva. (2018). Optimal control for soliton breathers of the Lakshmanan-Porsezian-Daniel, Hirota, and cmKdV models. *Optik* 175:17–27.
- N A Kudryashov. (2021). The Lakshmanan-Porsezian-Daniel model with arbitrary refractive index and its solution. *Optik* 241:167043.
- I Iqbal. (2024). Soliton unveilings in optical fiber transmission: Examining soliton structures through the Sasa-Satsuma equation. *Results in Physics* 60:107648.
- T Younas, J Ahmad. (2024). Dynamical behavior of the higher-order cubic-quintic nonlinear Schrödinger equation with stability analysis. *J. Opt*:1–23.
- M A Mostafa. (2024). Langmuir wave dynamics and plasma instabilities: Insights from generalized coupled nonlinear Schrödinger equations. *Mod. Phys. Lett. B* 38(36):2450366.
- A Ankiewicz, D J Kedziora, A Chowdury, U Bandelow, N Akhmediev. (2016). Infinite hierarchy of nonlinear Schrödinger equations and their solutions. *Phys. Rev. E* 93(1):12206.
- A Chowdury, W Krolikowski. (2017). Breather-to-soliton transformation rules in the hierarchy of nonlinear Schrödinger equations. *Phys. Rev. E* 95(6):62226.
- T Mathanaranjan. (2025). Solitary wave structures, conservation laws and dynamical analysis of the Heisenberg ferromagnet-type equation. *Mod. Phys. Lett. B* 2025:2550229.
- H Khatri, A Malik, M G Gautam. (2020). Traveling, periodic and localized solitary waves solutions of the (4+1)-dimensional nonlinear Fokas equation. *SN Appl. Sci* 2(11):1829.
- M M A El Sheikh. (2020). Optical solitons with differential group delay for coupled Kundu-Eckhaus equation using extended simplest equation approach. *Optik* 208:164051.
- T Mathanaranjan, M S Hashemi, H Rezazadeh, L Akinyemi, A Bekir. (2023). Chirped optical solitons and stability analysis of the nonlinear Schrödinger equation with nonlinear chromatic dispersion. *Commun. Theor. Phys* 75(8):85005.
- S El-Ganaini, H Kumar. (2023). A variety of new soliton structures and various dynamical behaviors of a discrete electrical lattice with nonlinear dispersion via variety of analytical architectures. *Math. Methods Appl. Sci* 46(2):2746–2772.
- H Kumar, F Chand. (2013). Optical solitary wave solutions for the higher order nonlinear Schrödinger equation with self-steepening and self-frequency shift effects. *Opt. Laser Technol* 54:265–273.
- S Ibrahim, A M Ashir, Y A Sabawi, D Baleanu. (2023). Realization of optical solitons from nonlinear Schrödinger equation using modified Sardar sub-equation technique. *Opt. Quant. Electron* 55(7):617.
- M H Ali, H M El-Owaidy, H M Ahmed, A A El-Deeb, I Samir. (2023). Optical solitons and complexitons for generalized Schrödinger-Hirota model by the modified extended direct algebraic method. *Opt. Quant. Electron* 55(8):675.
- J Vahidi, A Zabihi, H Rezazadeh, R Ansari. (2021). New extended direct algebraic method for the resonant nonlinear Schrödinger equation with Kerr law nonlinearity. *Optik* 227:165936.
- W B Rabiea, H H Hussein, H M Ahmed, M Alnahhass, W Alexan. (2024). Abundant solitons for highly dispersive nonlinear Schrödinger equation with sextic-power law refractive index using modified extended direct algebraic method. *Alex. Eng. J* 86:680–689.
- M M Fahim, H M Ahmed, K A Dib, I Samir. (2024). Derivation of dispersive solitons with quadrupled power law of nonlinearity using improved modified extended tanh function method. *J. Opt*:1–10.
- I Samir. (2024). Unraveling solitons dynamics in system of dispersive NLSE with Kudryashov's law of nonlinearity using improved modified extended tanh function method. *Alexandria Eng. J* 91:419–428.
- I Samir, H M Ahmed. (2024). Retrieval of solitons and other wave solutions for stochastic nonlinear Schrödinger equation with nonlocal nonlinearity using the improved modified extended tanh-function method. *J. Opt*:1–10.
- A Farooq, I K Muhammad, W X Ma. (2024). Exact solutions for the improved mKdv equation with conformable derivative by using the Jacobi elliptic function expansion method. *Opt. Quant. Electron* 56(4):542.
- H Kumar, F Chand. (2014). Chirped and chirpfree soliton solutions of generalized nonlinear Schrödinger equation with distributed coefficients. *Optik* 125(12):2938–2949.
- M Ali Akbar. (2021). Soliton solutions to the Boussinesq equation through sine-Gordon method and Kudryashov method. *Results Phys* 25:104228.
- B Mohan, S Kumar. (2025). Painlevé analysis, restricted bright-dark N-solitons, and N-rogue waves of a (4+1)-dimensional variablecoefficient generalized KP equation in nonlinear sciences. *Nonlinear Dyn* 113(10):11893–11906.
- S Kumar, B Mohan. (2023). A direct symbolic computation of center-controlled rogue waves to a new Painlevé-integrable (3+1)-D generalized nonlinear evolution equation in plasmas. *Nonlinear Dyn* 111(17):16395–16405.
